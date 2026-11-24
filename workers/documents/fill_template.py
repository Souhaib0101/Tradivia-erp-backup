#!/usr/bin/env python3
"""Fill the bundled Word templates and optionally convert them to PDF."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterator

from docx import Document


PLACEHOLDER_RE = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")


def _resolve(variables: dict[str, Any], key: str) -> Any:
    value: Any = variables
    for part in key.split("."):
        if not isinstance(value, dict) or part not in value:
            raise KeyError(key)
        value = value[part]
    return "" if value is None else value


def _iter_paragraphs(container: Any) -> Iterator[Any]:
    """Yield paragraphs from a document/header/cell, including nested tables."""
    yield from container.paragraphs
    for table in container.tables:
        seen_cells: set[Any] = set()
        for row in table.rows:
            for cell in row.cells:
                cell_xml = cell._tc
                if cell_xml in seen_cells:
                    continue
                seen_cells.add(cell_xml)
                yield from _iter_paragraphs(cell)


def _replace_in_paragraph(paragraph: Any, variables: dict[str, Any]) -> int:
    runs = paragraph.runs
    if not runs:
        return 0
    text = "".join(run.text for run in runs)
    matches = list(PLACEHOLDER_RE.finditer(text))
    if not matches:
        return 0

    replaced = 0
    for match in reversed(matches):
        try:
            replacement = str(_resolve(variables, match.group(1)))
        except KeyError:
            continue

        offsets: list[tuple[int, int]] = []
        cursor = 0
        for index, run in enumerate(runs):
            offsets.append((cursor, cursor + len(run.text)))
            cursor += len(run.text)

        start_run = end_run = None
        start_offset = end_offset = 0
        for index, (start, end) in enumerate(offsets):
            if start_run is None and start <= match.start() <= end:
                start_run = index
                start_offset = match.start() - start
            if start <= match.end() <= end:
                end_run = index
                end_offset = match.end() - start
                break
        if start_run is None or end_run is None:
            continue

        if start_run == end_run:
            original = runs[start_run].text
            runs[start_run].text = original[:start_offset] + replacement + original[end_offset:]
        else:
            runs[start_run].text = runs[start_run].text[:start_offset] + replacement
            for index in range(start_run + 1, end_run):
                runs[index].text = ""
            runs[end_run].text = runs[end_run].text[end_offset:]
        replaced += 1
    return replaced


def fill(template_path: str | Path, output_path: str | Path, variables: dict[str, Any]) -> int:
    template = Path(template_path)
    if not template.is_file():
        raise FileNotFoundError(f"Template introuvable: {template}")

    document = Document(template)
    containers: list[Any] = [document]
    for section in document.sections:
        containers.extend(
            [
                section.header,
                section.first_page_header,
                section.even_page_header,
                section.footer,
                section.first_page_footer,
                section.even_page_footer,
            ]
        )

    count = sum(
        _replace_in_paragraph(paragraph, variables)
        for container in containers
        for paragraph in _iter_paragraphs(container)
    )
    unresolved = sorted(
        {
            match.group(1)
            for container in containers
            for paragraph in _iter_paragraphs(container)
            for match in PLACEHOLDER_RE.finditer(paragraph.text)
        }
    )
    if unresolved:
        raise ValueError(f"Variables manquantes dans le modele: {', '.join(unresolved)}")
    document.save(output_path)
    return count


def to_pdf_windows(docx_path: Path, pdf_path: Path) -> None:
    try:
        import pythoncom
        import win32com.client
    except ImportError as error:
        raise RuntimeError("pywin32 est requis pour la conversion PDF avec Microsoft Word") from error

    pythoncom.CoInitialize()
    word = None
    document = None
    try:
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        document = word.Documents.Open(
            str(docx_path),
            ConfirmConversions=False,
            ReadOnly=True,
            AddToRecentFiles=False,
        )
        document.ExportAsFixedFormat(str(pdf_path), 17)
    except Exception as error:
        raise RuntimeError(f"Microsoft Word PDF export: {error}") from error
    finally:
        if document is not None:
            try:
                document.Close(False)
            except Exception:
                pass
        if word is not None:
            try:
                word.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()


def find_soffice() -> str | None:
    candidates = [
        shutil.which("soffice"),
        shutil.which("libreoffice"),
    ]
    if sys.platform == "win32":
        candidates.extend(
            [
                r"C:\Program Files\LibreOffice\program\soffice.exe",
                r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            ]
        )
    return next((str(candidate) for candidate in candidates if candidate and Path(candidate).is_file()), None)


def to_pdf_libreoffice(docx_path: Path, pdf_path: Path) -> None:
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError("LibreOffice est introuvable")
    completed = subprocess.run(
        [soffice, "--headless", "--convert-to", "pdf", str(docx_path), "--outdir", str(pdf_path.parent)],
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    if completed.returncode:
        raise RuntimeError(f"LibreOffice PDF export: {completed.stderr.strip()}")
    generated = pdf_path.parent / f"{docx_path.stem}.pdf"
    if generated != pdf_path and generated.exists():
        generated.replace(pdf_path)


def to_pdf(docx_path: str | Path, pdf_path: str | Path) -> None:
    source = Path(docx_path).resolve()
    output = Path(pdf_path).resolve()
    errors: list[str] = []
    if sys.platform == "win32":
        try:
            to_pdf_windows(source, output)
        except Exception as error:
            errors.append(str(error))
    if not output.exists():
        try:
            to_pdf_libreoffice(source, output)
        except Exception as error:
            errors.append(str(error))
    if not output.is_file() or output.stat().st_size < 5 or output.read_bytes()[:5] != b"%PDF-":
        details = " | ".join(errors) or "aucun convertisseur disponible"
        raise RuntimeError(f"PDF export did not create a valid file: {details}")


def main() -> None:
    args = sys.argv[1:]
    pdf_output = None
    if "--pdf" in args:
        index = args.index("--pdf")
        pdf_output = args[index + 1]
        del args[index : index + 2]
    if len(args) != 3:
        raise SystemExit("Usage: fill_template.py template.docx output.docx variables.json [--pdf output.pdf]")

    template, output, json_path = args
    with open(json_path, encoding="utf-8") as stream:
        variables = json.load(stream)
    count = fill(template, output, variables)
    print(f"Filled {count} placeholder(s): {output}")
    if pdf_output:
        to_pdf(output, pdf_output)
        print(f"PDF: {pdf_output}")


if __name__ == "__main__":
    main()
