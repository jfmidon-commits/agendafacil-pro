-- Migration 003: Functions & Concurrency
-- Funções para prevenção de double-booking e helpers

-- Função: Verificar conflito de horário
CREATE OR REPLACE FUNCTION public.check_appointment_conflict()
RETURNS TRIGGER AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM public.appointments
    WHERE professional_id = NEW.professional_id
      AND appointment_date = NEW.appointment_date
      AND status IN ('confirmed', 'pending')
      AND id != NEW.id
      AND (
          (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
      );

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Horário já reservado. Por favor, escolha outro horário.'
            USING HINT = 'double_booking';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_double_booking
    BEFORE INSERT OR UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.check_appointment_conflict();

-- Função: Obter slots disponíveis para um profissional em uma data
CREATE OR REPLACE FUNCTION public.get_available_slots(
    p_professional_id UUID,
    p_date DATE,
    p_service_duration INTEGER DEFAULT 30
)
RETURNS TABLE (slot_time TIME) AS $$
DECLARE
    v_day_of_week INTEGER;
    v_availability RECORD;
    v_slot TIME;
    v_booked_start TIME;
    v_booked_end TIME;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date);

    FOR v_availability IN
        SELECT start_time, end_time
        FROM public.availability
        WHERE professional_id = p_professional_id
          AND day_of_week = v_day_of_week
          AND is_active = true
    LOOP
        v_slot := v_availability.start_time;
        WHILE v_slot + (p_service_duration || ' minutes')::INTERVAL <= v_availability.end_time LOOP
            -- Verificar se o slot está livre
            IF NOT EXISTS (
                SELECT 1 FROM public.appointments
                WHERE professional_id = p_professional_id
                  AND appointment_date = p_date
                  AND status IN ('confirmed', 'pending')
                  AND (v_slot, v_slot + (p_service_duration || ' minutes')::INTERVAL)
                      OVERLAPS (start_time, end_time)
            ) THEN
                RETURN QUERY SELECT v_slot;
            END IF;
            v_slot := v_slot + (p_service_duration || ' minutes')::INTERVAL;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função: Criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função: Atualizar status de trial expirado
CREATE OR REPLACE FUNCTION public.check_expired_trials()
RETURNS void AS $$
BEGIN
    UPDATE public.businesses
    SET plan = 'free',
        trial_ends_at = NULL
    WHERE trial_ends_at < NOW()
      AND plan = 'free'
      AND trial_ends_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Seed: Categorias de plano (para referência)
COMMENT ON TABLE public.businesses IS 'Negócios cadastrados no sistema. Planos: free (limitado), pro (completo), enterprise (personalizado)';
COMMENT ON TABLE public.appointments IS 'Agendamentos. Status: pending, confirmed, cancelled, completed, no_show';
COMMENT ON FUNCTION public.get_available_slots IS 'Retorna todos os slots livres para um profissional em uma data específica';
