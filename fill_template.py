#!/usr/bin/env python3
import sys, json, re, subprocess
from pathlib import Path
from docx import Document

def replace_in_para(para, variables):
    if not any('{{' in r.text for r in para.runs):
        return
    full = ''.join(r.text for r in para.runs)
    new_text = re.sub(
        r'\{\{\s*([\w\.]+)\s*\}\}',
        lambda m: str(variables.get(m.group(1).strip(), m.group(0))),
        full
    )
    if para.runs:
        para.runs[0].text = new_text
        for r in para.runs[1:]:
            r.text = ''

def fill(template_path, output_path, variables):
    doc = Document(template_path)
    for p in doc.paragraphs:
        replace_in_para(p, variables)
    for tbl in doc.tables:
        for row in tbl.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    replace_in_para(p, variables)
    doc.save(output_path)

def to_pdf_windows(docx_path, pdf_path):
    import win32com.client
    word = win32com.client.Dispatch('Word.Application')
    word.Visible = False
    try:
        doc = word.Documents.Open(str(docx_path))
        doc.SaveAs(str(pdf_path), FileFormat=17)
        doc.Close(0)
    finally:
        word.Quit()

def to_pdf(docx_path, pdf_path):
    docx_path = Path(docx_path).resolve()
    pdf_path  = Path(pdf_path).resolve()

    if sys.platform == 'win32':
        to_pdf_windows(docx_path, pdf_path)
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

if __name__ == '__main__':
    args = sys.argv[1:]
    pdf_output = None
    if '--pdf' in args:
        idx = args.index('--pdf')
        pdf_output = args[idx + 1]
        args = args[:idx] + args[idx + 2:]
    template, output, json_path = args[0], args[1], args[2]
    with open(json_path, encoding='utf-8') as f:
        variables = json.load(f)
    fill(template, output, variables)
    print(f'Filled: {output}')
    if pdf_output:
        to_pdf(output, pdf_output)
        print(f'PDF: {pdf_output}')