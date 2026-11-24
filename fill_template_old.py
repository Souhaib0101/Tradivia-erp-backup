#!/usr/bin/env python3
"""
fill_template.py  <template.docx> <output.docx> <vars.json>
Replaces {{ variable }} placeholders in a DOCX (handles runs split by Word).
"""
# standard library imports and python-docx Document import
# sys for command-line args, json for reading variables, re for regex matching
import sys, json, re
from docx import Document

# Replace placeholder variables in a paragraph, preserving formatting of the first run.
def replace_in_para(para, variables):
    """Merge runs, replace vars, keep formatting of first run."""
    # Skip paragraphs with no placeholder marker
    if not any('{{' in r.text for r in para.runs):
        return
    # Concatenate all run text because Word may split placeholders across runs
    full = ''.join(r.text for r in para.runs)
    # Lookup replacement value for each variable placeholder
    def sub(m):
        key = m.group(1).strip()
        return str(variables.get(key, m.group(0)))
    # Replace placeholders in merged text
    
    new_text = re.sub(r'\{\{\s*([\w\.]+)\s*\}\}', sub, full)
    # Put the replaced text back into the first run and clear the rest
    if para.runs:
        para.runs[0].text = new_text
        for r in para.runs[1:]:
            r.text = ''

# Open the template document, replace placeholders in paragraphs and tables, then save output.
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

# Command-line entry point: read template, output, and JSON variables, then fill.
if __name__ == '__main__':
    template, output, json_path = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(json_path) as f:
        variables = json.load(f)
    fill(template, output, variables)
    print(f"Filled: {output}")
