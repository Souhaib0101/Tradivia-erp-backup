#!/usr/bin/env python3
"""Create and merge multiple filled invoice documents."""

from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement

from fill_template import to_pdf


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _start_on_new_page(paragraph_element: object) -> bool:
    """Start a copied invoice on a new page without creating a blank page."""
    if not paragraph_element.tag.endswith("}p"):
        return False
    properties = paragraph_element.find(f"{{{WORD_NS}}}pPr")
    if properties is None:
        properties = OxmlElement("w:pPr")
        paragraph_element.insert(0, properties)
    if properties.find(f"{{{WORD_NS}}}pageBreakBefore") is None:
        properties.append(OxmlElement("w:pageBreakBefore"))
    return True


def merge(template_path: str | Path, vars_list: list[dict], output_docx: str | Path, fill_script: str | Path) -> int:
    if not vars_list:
        raise ValueError("Aucune facture a fusionner")

    temporary_files: list[tuple[str, str]] = []
    try:
        for variables in vars_list:
            json_file = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
            docx_file = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
            json_file.close()
            docx_file.close()
            with open(json_file.name, "w", encoding="utf-8") as stream:
                json.dump(variables, stream, ensure_ascii=False)
            subprocess.run(
                [sys.executable, str(fill_script), str(template_path), docx_file.name, json_file.name],
                check=True,
            )
            temporary_files.append((json_file.name, docx_file.name))

        master = Document(temporary_files[0][1])
        body = master.element.body
        final_section = body[-1] if body[-1].tag.endswith("}sectPr") else None
        if final_section is not None:
            body.remove(final_section)

        for _, filename in temporary_files[1:]:
            source = Document(filename)
            page_break_added = False
            for element in source.element.body:
                if element.tag.endswith("}sectPr"):
                    continue
                cloned = copy.deepcopy(element)
                if cloned.tag.endswith("}p"):
                    properties = cloned.find(f"{{{WORD_NS}}}pPr")
                    if properties is not None:
                        section = properties.find(f"{{{WORD_NS}}}sectPr")
                        if section is not None:
                            properties.remove(section)
                    if not page_break_added:
                        page_break_added = _start_on_new_page(cloned)
                body.append(cloned)

            if not page_break_added:
                raise ValueError("La facture fusionnee ne contient aucun paragraphe utilisable")

        if final_section is not None:
            body.append(final_section)
        master.save(output_docx)
        return len(temporary_files)
    finally:
        for json_name, docx_name in temporary_files:
            for filename in (json_name, docx_name):
                try:
                    os.remove(filename)
                except FileNotFoundError:
                    pass


def main() -> None:
    args = sys.argv[1:]
    pdf_output = None
    if "--pdf" in args:
        index = args.index("--pdf")
        pdf_output = args[index + 1]
        del args[index : index + 2]

    fill_script: str | Path = Path(__file__).resolve().parent / "fill_template.py"
    if "--fill-script" in args:
        index = args.index("--fill-script")
        fill_script = args[index + 1]
        del args[index : index + 2]
    if len(args) != 3:
        raise SystemExit("Usage: merge_invoices.py template.docx variables.json output.docx [--pdf output.pdf]")

    template, variables_path, output = args
    with open(variables_path, encoding="utf-8") as stream:
        variables = json.load(stream)
    count = merge(template, variables, output, fill_script)
    print(f"Merged {count} invoice(s): {output}")
    if pdf_output:
        to_pdf(output, pdf_output)
        print(f"PDF: {pdf_output}")


if __name__ == "__main__":
    main()
