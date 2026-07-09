ALTER TABLE public.action_plans ALTER COLUMN immersion_id DROP NOT NULL;
DROP TRIGGER IF EXISTS trg_action_plans_company_id ON public.action_plans;
CREATE TRIGGER trg_action_plans_company_id BEFORE INSERT ON public.action_plans FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
DROP TRIGGER IF EXISTS trg_action_plans_updated_at ON public.action_plans;
CREATE TRIGGER trg_action_plans_updated_at BEFORE UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();