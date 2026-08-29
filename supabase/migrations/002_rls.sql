-- Migration 002: Row Level Security (RLS)
-- Protege dados por usuário/negócio

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Políticas para businesses
CREATE POLICY "Anyone can view active businesses"
    ON public.businesses FOR SELECT
    USING (is_active = true);

CREATE POLICY "Owners can manage own business"
    ON public.businesses FOR ALL
    USING (auth.uid() = owner_id);

-- Políticas para professionals (visíveis publicamente)
CREATE POLICY "Anyone can view active professionals"
    ON public.professionals FOR SELECT
    USING (is_active = true);

CREATE POLICY "Business owners can manage professionals"
    ON public.professionals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = professionals.business_id
            AND b.owner_id = auth.uid()
        )
    );

-- Políticas para services (visíveis publicamente)
CREATE POLICY "Anyone can view active services"
    ON public.services FOR SELECT
    USING (is_active = true);

CREATE POLICY "Business owners can manage services"
    ON public.services FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = services.business_id
            AND b.owner_id = auth.uid()
        )
    );

-- Políticas para availability (visível publicamente)
CREATE POLICY "Anyone can view availability"
    ON public.availability FOR SELECT
    USING (is_active = true);

CREATE POLICY "Business owners can manage availability"
    ON public.availability FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.professionals p
            JOIN public.businesses b ON b.id = p.business_id
            WHERE p.id = availability.professional_id
            AND b.owner_id = auth.uid()
        )
    );

-- Políticas para appointments
CREATE POLICY "Anyone can create appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can view confirmed appointments"
    ON public.appointments FOR SELECT
    USING (status IN ('confirmed', 'completed'));

CREATE POLICY "Business owners can manage all appointments"
    ON public.appointments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = appointments.business_id
            AND b.owner_id = auth.uid()
        )
    );

CREATE POLICY "Clients can view own appointments"
    ON public.appointments FOR SELECT
    USING (client_email = auth.jwt() ->> 'email');
