-- seed_test_data.sql — Dados para testar o fluxo completo

-- Criar usuário de teste (será feito via auth, mas preparamos o perfil)
-- O handle_new_user trigger cria o perfil automaticamente

-- Criar negócio de teste
INSERT INTO public.businesses (owner_id, slug, name, description, phone, whatsapp, plan)
VALUES (
    '00000000-0000-0000-0000-000000000001', -- será substituído pelo UUID real do owner
    'barbearia-vintage',
    'Barbearia Vintage',
    'Cortes clássicos e modernos com atendimento premium',
    '(51) 99999-9999',
    '51999999999',
    'pro'
);

-- Criar profissional
INSERT INTO public.professionals (business_id, name, bio, is_active)
SELECT 
    id,
    'Carlos Silva',
    'Especialista em degradê e barba. 10 anos de experiência.',
    true
FROM public.businesses WHERE slug = 'barbearia-vintage';

-- Criar serviço: Corte
INSERT INTO public.services (business_id, name, description, duration_minutes, price_cents, color, is_active)
SELECT 
    id,
    'Corte',
    'Corte de cabelo masculino com acabamento perfeito',
    30,
    3500,
    '#8B5CF6',
    true
FROM public.businesses WHERE slug = 'barbearia-vintage';

-- Criar disponibilidade: Seg-Sex 9h-18h, Sáb 9h-14h
INSERT INTO public.availability (professional_id, day_of_week, start_time, end_time)
SELECT 
    p.id,
    d.day,
    d.start_t,
    d.end_t
FROM public.professionals p
CROSS JOIN (VALUES 
    (1, '09:00'::time, '18:00'::time),
    (2, '09:00'::time, '18:00'::time),
    (3, '09:00'::time, '18:00'::time),
    (4, '09:00'::time, '18:00'::time),
    (5, '09:00'::time, '18:00'::time),
    (6, '09:00'::time, '14:00'::time)
) AS d(day, start_t, end_t)
WHERE p.name = 'Carlos Silva';

-- Verificar dados inseridos
SELECT 'Businesses' as table_name, COUNT(*) as count FROM public.businesses
UNION ALL
SELECT 'Professionals', COUNT(*) FROM public.professionals
UNION ALL
SELECT 'Services', COUNT(*) FROM public.services
UNION ALL
SELECT 'Availability', COUNT(*) FROM public.availability;
