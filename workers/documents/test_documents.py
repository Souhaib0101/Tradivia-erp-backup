#!/usr/bin/env python3
"""Regression tests for the canonical document workers and bundled templates."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from docx import Document

from fill_template import PLACEHOLDER_RE, _iter_paragraphs, fill
from merge_invoices import merge


HERE = Path(__file__).resolve().parent
TEMPLATES = HERE / "templates"

INVOICE_VARIABLES = {
    "client_nom": "Client Test",
    "client_identity": "ICE : 001234567890123",
    "client_adresse": "Casablanca",
    "numero": "TEST/2026/001",
    "lieu": "CASABLANCA",
    "date": "13/08/2026",
    "qte_kg": "100",
    "designation": "CAFE VERT",
    "pu_ttc": "12,00",
    "pt_ttc": "1 200,00",
    "ajustement_arrondi": "0,00",
    "montant_ht": "1 000,00",
    "tva": "200,00",
    "total_ttc": "1 200,00",
    "mode_paiement": "Virement bancaire",
    "pt_ttc_letters": "mille deux cents dirhams",
}


def document_text(document: Document) -> str:
    containers = [document]
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
    return "\n".join(
        paragraph.text
        for container in containers
        for paragraph in _iter_paragraphs(container)
    )


class DocumentWorkerTests(unittest.TestCase):
    def assert_valid_docx(self, path: Path) -> None:
        self.assertTrue(path.is_file())
        self.assertGreater(path.stat().st_size, 0)
        with ZipFile(path) as archive:
            self.assertIsNone(archive.testzip())

    def fill_and_assert(self, template_name: str, variables: dict[str, str]) -> None:
        with tempfile.TemporaryDirectory(prefix="tradivia-worker-test-") as temp_dir:
            output = Path(temp_dir) / "output.docx"
            count = fill(TEMPLATES / template_name, output, variables)
            self.assertGreater(count, 0)
            self.assert_valid_docx(output)
            self.assertIsNone(PLACEHOLDER_RE.search(document_text(Document(output))))

    def test_all_bundled_templates_fill(self) -> None:
        cases = [
            ("template_Tradivia_ajust.docx", INVOICE_VARIABLES),
            (
                "template_tradivia.docx",
                {
                    **INVOICE_VARIABLES,
                    "client": {
                        "name": "Client Test",
                        "ice": "001234567890123",
                    },
                },
            ),
            (
                "template_ordre_virement_TVA.docx",
                {"date": "13/08/2026", "montant": "1 200,00"},
            ),
            (
                "template_Ordre_de_virement_zizi.docx",
                {
                    "date": "13/08/2026",
                    "nom": "Beneficiaire Test",
                    "RIB": "007640001380700000021864",
                    "montant": "1 200,00",
                    "montant_lettres": "mille deux cents",
                },
            ),
        ]
        for template_name, variables in cases:
            with self.subTest(template=template_name):
                self.fill_and_assert(template_name, variables)

    def test_split_placeholder_preserves_surrounding_run_formatting(self) -> None:
        with tempfile.TemporaryDirectory(prefix="tradivia-worker-test-") as temp_dir:
            root = Path(temp_dir)
            template = root / "template.docx"
            output = root / "output.docx"
            document = Document()
            paragraph = document.add_paragraph()
            first = paragraph.add_run("Avant {{ cli")
            first.bold = True
            second = paragraph.add_run("ent }} apres")
            second.italic = True
            document.sections[0].header.paragraphs[0].text = "Dossier {{ numero }}"
            nested = document.add_table(rows=1, cols=1).cell(0, 0).add_table(rows=1, cols=1)
            nested.cell(0, 0).text = "{{ adresse }}"
            document.save(template)

            fill(
                template,
                output,
                {"client": "Tradivia", "numero": "42", "adresse": "Casablanca"},
            )
            result = Document(output)
            result_paragraph = result.paragraphs[0]
            self.assertEqual(result_paragraph.text, "Avant Tradivia apres")
            self.assertTrue(result_paragraph.runs[0].bold)
            self.assertTrue(result_paragraph.runs[-1].italic)
            self.assertIn("Dossier 42", document_text(result))
            self.assertIn("Casablanca", document_text(result))

    def test_missing_placeholder_fails_instead_of_shipping_a_broken_document(self) -> None:
        with tempfile.TemporaryDirectory(prefix="tradivia-worker-test-") as temp_dir:
            root = Path(temp_dir)
            template = root / "template.docx"
            output = root / "output.docx"
            document = Document()
            document.add_paragraph("Facture {{ numero }} - {{ client_nom }}")
            document.save(template)

            with self.assertRaisesRegex(ValueError, "client_nom"):
                fill(template, output, {"numero": "TEST-001"})
            self.assertFalse(output.exists())

    def test_two_invoice_merge_is_valid_and_filled(self) -> None:
        with tempfile.TemporaryDirectory(prefix="tradivia-worker-test-") as temp_dir:
            output = Path(temp_dir) / "merged.docx"
            second = {**INVOICE_VARIABLES, "numero": "TEST/2026/002"}
            count = merge(
                TEMPLATES / "template_Tradivia_ajust.docx",
                [INVOICE_VARIABLES, second],
                output,
                HERE / "fill_template.py",
            )
            self.assertEqual(count, 2)
            self.assert_valid_docx(output)
            text = document_text(Document(output))
            self.assertIsNone(PLACEHOLDER_RE.search(text))
            self.assertIn("TEST/2026/001", text)
            self.assertIn("TEST/2026/002", text)


if __name__ == "__main__":
    unittest.main()
