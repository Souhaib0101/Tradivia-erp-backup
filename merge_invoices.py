#!/usr/bin/env python3

import sys
import json
import subprocess
import tempfile
import os
import copy
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK


def add_page_break(doc):
    p = doc.add_paragraph()
    run = p.add_run()
    run.add_break(WD_BREAK.PAGE)


def to_pdf(docx_path, pdf_path):
    docx_path = Path(docx_path).resolve()
    pdf_path = Path(pdf_path).resolve()

    if sys.platform == 'win32':
        import win32com.client
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        try:
            doc = word.Documents.Open(str(docx_path))
            doc.SaveAs(str(pdf_path), FileFormat=17)  # PDF
            doc.Close(False)
        finally:
            word.Quit()
        return

    if sys.platform == 'darwin':
        candidates = ['/Applications/LibreOffice.app/Contents/MacOS/soffice', 'soffice']
    else:
        candidates = ['/usr/bin/soffice', '/usr/bin/libreoffice', '/snap/bin/libreoffice', 'soffice']

    soffice = next((c for c in candidates if Path(c).exists()), 'soffice')
    out_dir = pdf_path.parent
    expected = out_dir / (docx_path.stem + '.pdf')
    r = subprocess.run(
        [soffice, '--headless', '--convert-to', 'pdf', str(docx_path), '--outdir', str(out_dir)],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        raise RuntimeError(f'LibreOffice: {r.stderr}')
    if expected != pdf_path and expected.exists():
        expected.rename(pdf_path)


def merge(template_path, vars_list, output_docx, fill_script):
    tmp_files = []

    try:
        for vars_ in vars_list:
            tmp_json = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
            tmp_docx = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
            tmp_json.close()
            tmp_docx.close()

            with open(tmp_json.name, "w", encoding="utf-8") as f:
                json.dump(vars_, f, ensure_ascii=False)

            subprocess.run(
                [sys.executable, fill_script, template_path, tmp_docx.name, tmp_json.name],
                check=True,
            )

            tmp_files.append((tmp_json.name, tmp_docx.name))

        if not tmp_files:
            raise RuntimeError("No invoices to merge.")

        master = Document(tmp_files[0][1])
        body = master.element.body

        # The final child of body is the document's own sectPr (page size, margins,
        # headers/footers). It MUST remain the very last element in the body, or
        # LibreOffice/Word treats whatever comes after it as an orphaned section
        # with no closing sectPr — which is exactly what produces those blank
        # "footer-only" pages. So: pull it out now, append everything else, then
        # put it back at the very end.
        master_sectPr = body[-1]
        if master_sectPr.tag.endswith('}sectPr'):
            body.remove(master_sectPr)
        else:
            master_sectPr = None

        for _, docx in tmp_files[1:]:
            add_page_break(master)

            sub = Document(docx)

            for element in sub.element.body:
                # Skip ALL sectPr from sub-documents, whether they're the final
                # body-level sectPr or one embedded in a paragraph's pPr (which
                # happens if the sub-doc itself has multiple sections).
                if element.tag.endswith('}sectPr'):
                    continue
                if element.tag.endswith('}p'):
                    pPr = element.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPr')
                    if pPr is not None:
                        inner_sectPr = pPr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sectPr')
                        if inner_sectPr is not None:
                            pPr.remove(inner_sectPr)
                master.element.body.append(copy.deepcopy(element))

        if master_sectPr is not None:
            body.append(master_sectPr)

        master.save(output_docx)

    finally:
        for json_file, docx_file in tmp_files:
            if os.path.exists(json_file):
                os.remove(json_file)
            if os.path.exists(docx_file):
                os.remove(docx_file)


if __name__ == "__main__":
    args = sys.argv[1:]

    pdf_output = None
    if "--pdf" in args:
        i = args.index("--pdf")
        pdf_output = args[i + 1]
        args = args[:i] + args[i + 2:]

    fill_script = str(Path(__file__).resolve().parent / "fill_template.py")
    if "--fill-script" in args:
        i = args.index("--fill-script")
        fill_script = args[i + 1]
        args = args[:i] + args[i + 2:]

    if len(args) != 3:
        print(
            "Usage: merge_invoices.py template.docx vars.json output.docx [--pdf output.pdf] [--fill-script path]"
        )
        sys.exit(1)

    template_path, vars_json_path, output_docx = args

    with open(vars_json_path, encoding="utf-8") as f:
        vars_list = json.load(f)

    merge(template_path, vars_list, output_docx, fill_script)

    if pdf_output:
        to_pdf(output_docx, pdf_output)