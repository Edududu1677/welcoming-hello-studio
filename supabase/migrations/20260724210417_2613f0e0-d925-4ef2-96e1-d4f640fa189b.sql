
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'operador', 'consulta');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.current_user_has_any_role(_roles app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles)) $$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') $$;

CREATE OR REPLACE FUNCTION public.can_write() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','gerente','operador')) $$;

CREATE OR REPLACE FUNCTION public.can_read() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) $$;

-- Auto-create profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consulta');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles policies
CREATE POLICY "read own or admin reads all" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "update own or admin" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "admin insert profiles" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR id = auth.uid());
CREATE POLICY "admin delete profiles" ON public.profiles FOR DELETE TO authenticated
USING (public.is_admin());

-- user_roles policies
CREATE POLICY "read own roles or admin" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Timestamp trigger helper
CREATE OR REPLACE FUNCTION public.tg_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER _t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  margem_padrao NUMERIC(6,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read categories" ON public.categories FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write categories" ON public.categories FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]));
CREATE TRIGGER _t_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  endereco TEXT,
  vendedor TEXT,
  prazo_entrega_dias INT,
  condicoes_pagamento TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write suppliers" ON public.suppliers FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]));
CREATE TRIGGER _t_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno TEXT,
  codigo_barras TEXT UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  marca TEXT,
  categoria_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategoria TEXT,
  unidade_medida TEXT NOT NULL DEFAULT 'UN',
  qtd_por_embalagem NUMERIC(12,3),
  fornecedor_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  custo_ultima_compra NUMERIC(12,4) NOT NULL DEFAULT 0,
  custo_medio NUMERIC(12,4) NOT NULL DEFAULT 0,
  preco_venda NUMERIC(12,2) NOT NULL DEFAULT 0,
  margem_atual NUMERIC(6,2),
  markup_atual NUMERIC(6,2),
  estoque_atual NUMERIC(14,3) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(14,3) NOT NULL DEFAULT 0,
  estoque_maximo NUMERIC(14,3),
  localizacao TEXT,
  imagem_url TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  pendente_revisao BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_codigo_barras ON public.products(codigo_barras);
CREATE INDEX idx_products_nome ON public.products USING gin(to_tsvector('portuguese', nome));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read products" ON public.products FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write products" ON public.products FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin','gerente','operador']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin','gerente','operador']::app_role[]));
CREATE TRIGGER _t_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- PRODUCT BATCHES (lotes/validade)
CREATE TABLE public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lote TEXT,
  validade DATE,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 0,
  custo_unitario NUMERIC(12,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_batches TO authenticated;
GRANT ALL ON public.product_batches TO service_role;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read batches" ON public.product_batches FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write batches" ON public.product_batches FOR ALL TO authenticated
USING (public.can_write()) WITH CHECK (public.can_write());

-- STOCK MOVEMENTS
CREATE TYPE public.stock_movement_type AS ENUM (
  'entrada_compra','saida_venda','ajuste','perda','avaria','vencimento',
  'consumo_interno','bonificacao','devolucao_fornecedor','cancelamento_venda',
  'inventario','transferencia','importacao_inicial'
);
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  tipo stock_movement_type NOT NULL,
  quantidade NUMERIC(14,3) NOT NULL,
  estoque_anterior NUMERIC(14,3) NOT NULL,
  estoque_posterior NUMERIC(14,3) NOT NULL,
  custo_unitario NUMERIC(12,4),
  motivo TEXT,
  documento_ref TEXT,
  batch_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_mov_product ON public.stock_movements(product_id, created_at DESC);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read movements" ON public.stock_movements FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "insert movements" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (public.can_write());

-- SUPPLIERS PURCHASES / NOTAS
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  numero_nota TEXT,
  chave_acesso TEXT,
  data_emissao DATE,
  data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_produtos NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_frete NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_despesas NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_descontos NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_tributos NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT,
  observacoes TEXT,
  anexo_url TEXT,
  xml_raw TEXT,
  origem TEXT NOT NULL DEFAULT 'manual', -- manual | xml | planilha | ocr
  status TEXT NOT NULL DEFAULT 'lancada', -- rascunho | lancada | cancelada
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read purchases" ON public.purchases FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write purchases" ON public.purchases FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]));
CREATE TRIGGER _t_purchases_updated BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  codigo_barras TEXT,
  descricao TEXT,
  quantidade NUMERIC(14,3) NOT NULL,
  unidade TEXT,
  valor_unitario NUMERIC(12,4) NOT NULL,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  frete_rateado NUMERIC(12,4) NOT NULL DEFAULT 0,
  despesa_rateada NUMERIC(12,4) NOT NULL DEFAULT 0,
  tributo_rateado NUMERIC(12,4) NOT NULL DEFAULT 0,
  custo_total_unitario NUMERIC(12,4) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  lote TEXT,
  validade DATE,
  preco_venda_sugerido NUMERIC(12,2),
  atualiza_preco BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read purchase items" ON public.purchase_items FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write purchase items" ON public.purchase_items FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]));

-- SALES
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_venda TEXT,
  numero_transacao TEXT,
  data_venda TIMESTAMPTZ NOT NULL,
  operador TEXT,
  forma_pagamento TEXT,
  valor_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  custo_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  lucro_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
  import_batch_id UUID,
  hash_dedupe TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_data ON public.sales(data_venda DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sales" ON public.sales FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write sales" ON public.sales FOR ALL TO authenticated
USING (public.can_write()) WITH CHECK (public.can_write());

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  codigo_barras TEXT,
  descricao TEXT,
  quantidade NUMERIC(14,3) NOT NULL,
  preco_unitario NUMERIC(12,4) NOT NULL,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL,
  custo_unitario NUMERIC(12,4) NOT NULL DEFAULT 0,
  lucro NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sale items" ON public.sale_items FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write sale items" ON public.sale_items FOR ALL TO authenticated
USING (public.can_write()) WITH CHECK (public.can_write());

-- IMPORT BATCHES
CREATE TYPE public.import_type AS ENUM ('estoque_inicial','estoque_substituir','estoque_ajustar','estoque_somar','vendas','nfe_xml');
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo import_type NOT NULL,
  arquivo_nome TEXT,
  arquivo_url TEXT,
  registros_total INT NOT NULL DEFAULT 0,
  registros_ok INT NOT NULL DEFAULT 0,
  registros_erro INT NOT NULL DEFAULT 0,
  registros_duplicados INT NOT NULL DEFAULT 0,
  resumo JSONB,
  erros JSONB,
  status TEXT NOT NULL DEFAULT 'concluido', -- rascunho | concluido | revertido
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read imports" ON public.import_batches FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write imports" ON public.import_batches FOR ALL TO authenticated
USING (public.can_write()) WITH CHECK (public.can_write());

-- LOSSES
CREATE TABLE public.losses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantidade NUMERIC(14,3) NOT NULL,
  custo_unitario NUMERIC(12,4),
  valor_total NUMERIC(14,2),
  motivo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'perda', -- perda | avaria | vencimento
  data_evento DATE NOT NULL DEFAULT CURRENT_DATE,
  responsavel TEXT,
  foto_url TEXT,
  observacoes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.losses TO authenticated;
GRANT ALL ON public.losses TO service_role;
ALTER TABLE public.losses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read losses" ON public.losses FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write losses" ON public.losses FOR ALL TO authenticated
USING (public.can_write()) WITH CHECK (public.can_write());

-- INVENTORIES
CREATE TABLE public.inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  escopo TEXT NOT NULL DEFAULT 'completo',
  status TEXT NOT NULL DEFAULT 'aberto', -- aberto | fechado | cancelado
  aberto_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_em TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventories TO authenticated;
GRANT ALL ON public.inventories TO service_role;
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inv" ON public.inventories FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write inv" ON public.inventories FOR ALL TO authenticated
USING (public.can_write()) WITH CHECK (public.can_write());

CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantidade_sistema NUMERIC(14,3) NOT NULL,
  quantidade_contada NUMERIC(14,3),
  diferenca NUMERIC(14,3),
  ajustado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read inv items" ON public.inventory_items FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write inv items" ON public.inventory_items FOR ALL TO authenticated
USING (public.can_write()) WITH CHECK (public.can_write());

-- EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outras',
  fornecedor_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  valor NUMERIC(14,2) NOT NULL,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  forma_pagamento TEXT,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | pago | vencido | cancelado
  recorrencia TEXT,
  comprovante_url TEXT,
  observacoes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read expenses" ON public.expenses FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write expenses" ON public.expenses FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]));
CREATE TRIGGER _t_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ALERTS
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL DEFAULT 'info',
  titulo TEXT NOT NULL,
  descricao TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'novo', -- novo | visto | resolvido | ignorado
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read alerts" ON public.alerts FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write alerts" ON public.alerts FOR ALL TO authenticated
USING (public.can_write()) WITH CHECK (public.can_write());

-- PRICE/COST HISTORY
CREATE TABLE public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  preco_anterior NUMERIC(12,2),
  preco_novo NUMERIC(12,2) NOT NULL,
  motivo TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ph" ON public.price_history FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write ph" ON public.price_history FOR INSERT TO authenticated WITH CHECK (public.can_write());

CREATE TABLE public.cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custo_anterior NUMERIC(12,4),
  custo_novo NUMERIC(12,4) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'ultimo', -- ultimo | medio
  documento_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cost_history TO authenticated;
GRANT ALL ON public.cost_history TO service_role;
ALTER TABLE public.cost_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ch" ON public.cost_history FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "write ch" ON public.cost_history FOR INSERT TO authenticated WITH CHECK (public.can_write());

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  dados_antes JSONB,
  dados_depois JSONB,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read audit admin" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin() OR user_id = auth.uid());
CREATE POLICY "insert audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- SETTINGS (singleton)
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome_empresa TEXT NOT NULL DEFAULT 'Minha MiniMercado',
  cnpj TEXT,
  endereco TEXT,
  telefone TEXT,
  logo_url TEXT,
  margem_padrao NUMERIC(6,2) NOT NULL DEFAULT 30,
  markup_padrao NUMERIC(6,2) NOT NULL DEFAULT 40,
  margem_minima NUMERIC(6,2) NOT NULL DEFAULT 10,
  estoque_minimo_padrao NUMERIC(14,3) NOT NULL DEFAULT 5,
  regra_arredondamento TEXT NOT NULL DEFAULT 'centavo', -- centavo|99|90|49|inteiro|sem
  taxa_cartao NUMERIC(6,2) NOT NULL DEFAULT 0,
  perc_perdas NUMERIC(6,2) NOT NULL DEFAULT 0,
  permite_estoque_negativo BOOLEAN NOT NULL DEFAULT false,
  metodo_custo TEXT NOT NULL DEFAULT 'medio', -- medio | ultimo
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read settings" ON public.settings FOR SELECT TO authenticated USING (public.can_read());
CREATE POLICY "update settings" ON public.settings FOR UPDATE TO authenticated
USING (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['admin','gerente']::app_role[]));

-- Helper: apply stock movement + update product estoque atomically
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  _product_id UUID,
  _tipo stock_movement_type,
  _quantidade NUMERIC,
  _custo NUMERIC,
  _motivo TEXT,
  _documento_ref TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _estoque_anterior NUMERIC;
  _estoque_posterior NUMERIC;
  _mov_id UUID;
  _permite_neg BOOLEAN;
BEGIN
  IF NOT public.can_write() THEN
    RAISE EXCEPTION 'Sem permissão para movimentar estoque';
  END IF;
  SELECT permite_estoque_negativo INTO _permite_neg FROM public.settings WHERE id = 1;
  SELECT estoque_atual INTO _estoque_anterior FROM public.products WHERE id = _product_id FOR UPDATE;
  IF _estoque_anterior IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  _estoque_posterior := _estoque_anterior + _quantidade;
  IF _estoque_posterior < 0 AND NOT COALESCE(_permite_neg,false) THEN
    RAISE EXCEPTION 'Estoque não pode ficar negativo (produto %)', _product_id;
  END IF;
  INSERT INTO public.stock_movements(product_id,tipo,quantidade,estoque_anterior,estoque_posterior,custo_unitario,motivo,documento_ref,user_id)
  VALUES(_product_id,_tipo,_quantidade,_estoque_anterior,_estoque_posterior,_custo,_motivo,_documento_ref,auth.uid())
  RETURNING id INTO _mov_id;
  UPDATE public.products SET estoque_atual = _estoque_posterior WHERE id = _product_id;
  RETURN _mov_id;
END; $$;

REVOKE ALL ON FUNCTION public.apply_stock_movement(UUID,stock_movement_type,NUMERIC,NUMERIC,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_stock_movement(UUID,stock_movement_type,NUMERIC,NUMERIC,TEXT,TEXT) TO authenticated;
