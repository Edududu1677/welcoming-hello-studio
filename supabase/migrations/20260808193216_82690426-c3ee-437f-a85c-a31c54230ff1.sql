CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  endereco TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stores_select" ON public.stores FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "stores_insert" ON public.stores FOR INSERT TO authenticated WITH CHECK (public.can_write());
CREATE POLICY "stores_update" ON public.stores FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());
CREATE POLICY "stores_delete" ON public.stores FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER _t_stores_updated BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

INSERT INTO public.stores (id, nome) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Mercado 1'),
  ('22222222-2222-2222-2222-222222222222', 'Mercado 2');

ALTER TABLE public.products ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.sales ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.purchases ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.expenses ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.losses ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.stock_movements ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.inventories ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.alerts ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT;

UPDATE public.products SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id IS NULL;
UPDATE public.sales SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id IS NULL;
UPDATE public.purchases SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id IS NULL;
UPDATE public.expenses SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id IS NULL;
UPDATE public.losses SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id IS NULL;
UPDATE public.stock_movements SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id IS NULL;
UPDATE public.inventories SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id IS NULL;
UPDATE public.alerts SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id IS NULL;

ALTER TABLE public.products ALTER COLUMN store_id SET NOT NULL, ALTER COLUMN store_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE public.sales ALTER COLUMN store_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE public.purchases ALTER COLUMN store_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE public.expenses ALTER COLUMN store_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE public.losses ALTER COLUMN store_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE public.stock_movements ALTER COLUMN store_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE public.inventories ALTER COLUMN store_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE public.alerts ALTER COLUMN store_id SET DEFAULT '11111111-1111-1111-1111-111111111111';

CREATE INDEX idx_products_store ON public.products(store_id);
CREATE INDEX idx_sales_store ON public.sales(store_id);
CREATE INDEX idx_purchases_store ON public.purchases(store_id);
CREATE INDEX idx_expenses_store ON public.expenses(store_id);
CREATE INDEX idx_losses_store ON public.losses(store_id);
CREATE INDEX idx_stock_movements_store ON public.stock_movements(store_id);

CREATE OR REPLACE FUNCTION public.apply_stock_movement(_product_id uuid, _tipo stock_movement_type, _quantidade numeric, _custo numeric, _motivo text, _documento_ref text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _estoque_anterior NUMERIC;
  _estoque_posterior NUMERIC;
  _mov_id UUID;
  _permite_neg BOOLEAN;
  _store UUID;
BEGIN
  IF NOT public.can_write() THEN
    RAISE EXCEPTION 'Sem permissão para movimentar estoque';
  END IF;
  SELECT permite_estoque_negativo INTO _permite_neg FROM public.settings WHERE id = 1;
  SELECT estoque_atual, store_id INTO _estoque_anterior, _store FROM public.products WHERE id = _product_id FOR UPDATE;
  IF _estoque_anterior IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  _estoque_posterior := _estoque_anterior + _quantidade;
  IF _estoque_posterior < 0 AND NOT COALESCE(_permite_neg,false) THEN
    RAISE EXCEPTION 'Estoque não pode ficar negativo (produto %)', _product_id;
  END IF;
  INSERT INTO public.stock_movements(product_id,tipo,quantidade,estoque_anterior,estoque_posterior,custo_unitario,motivo,documento_ref,user_id,store_id)
  VALUES(_product_id,_tipo,_quantidade,_estoque_anterior,_estoque_posterior,_custo,_motivo,_documento_ref,auth.uid(),_store)
  RETURNING id INTO _mov_id;
  UPDATE public.products SET estoque_atual = _estoque_posterior WHERE id = _product_id;
  RETURN _mov_id;
END; $function$;