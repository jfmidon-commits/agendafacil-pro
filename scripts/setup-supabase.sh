#!/bin/bash
# setup-supabase.sh — Executa as 3 migrations no Supabase

set -e

echo "🚀 AgendaFácil Pro — Setup do Banco de Dados"
echo "============================================="

if [ -z "$SUPABASE_DB_URL" ]; then
    echo "❌ Erro: Defina SUPABASE_DB_URL"
    echo "   Format: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
    exit 1
fi

echo ""
echo "📦 Migration 001: Schema Foundation"
psql "$SUPABASE_DB_URL" -f supabase/migrations/001_schema.sql
echo "   ✅ Tabelas criadas"

echo ""
echo "🔒 Migration 002: Row Level Security"
psql "$SUPABASE_DB_URL" -f supabase/migrations/002_rls.sql
echo "   ✅ RLS ativado"

echo ""
echo "⚙️  Migration 003: Functions & Concurrency"
psql "$SUPABASE_DB_URL" -f supabase/migrations/003_functions.sql
echo "   ✅ Funções e triggers criados"

echo ""
echo "🎉 Banco de dados configurado com sucesso!"
echo ""
echo "📊 Resumo das tabelas:"
psql "$SUPABASE_DB_URL" -c "\dt public.*"
