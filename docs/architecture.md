# Architecture

API : `routes → controller → service → repository/database`.
Chaque domaine (`auth`, `invoices`, `clients`, `containers`, `expenses`, `accounting`) suit cette structure. Les exports DOCX/PDF sont exécutés seulement par `workers/documents`.
