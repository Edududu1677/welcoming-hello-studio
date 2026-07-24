export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          metadata: Json | null
          product_id: string | null
          severidade: string
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          severidade?: string
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          severidade?: string
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          motivo: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          motivo?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          motivo?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          margem_padrao: number | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          margem_padrao?: number | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          margem_padrao?: number | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      cost_history: {
        Row: {
          created_at: string
          custo_anterior: number | null
          custo_novo: number
          documento_ref: string | null
          id: string
          product_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          custo_anterior?: number | null
          custo_novo: number
          documento_ref?: string | null
          id?: string
          product_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          custo_anterior?: number | null
          custo_novo?: number
          documento_ref?: string | null
          id?: string
          product_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          categoria: string
          comprovante_url: string | null
          created_at: string
          data_lancamento: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          observacoes: string | null
          recorrencia: string | null
          status: string
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          categoria?: string
          comprovante_url?: string | null
          created_at?: string
          data_lancamento?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          recorrencia?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          valor: number
        }
        Update: {
          categoria?: string
          comprovante_url?: string | null
          created_at?: string
          data_lancamento?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          recorrencia?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string
          erros: Json | null
          id: string
          registros_duplicados: number
          registros_erro: number
          registros_ok: number
          registros_total: number
          resumo: Json | null
          status: string
          tipo: Database["public"]["Enums"]["import_type"]
          user_id: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          erros?: Json | null
          id?: string
          registros_duplicados?: number
          registros_erro?: number
          registros_ok?: number
          registros_total?: number
          resumo?: Json | null
          status?: string
          tipo: Database["public"]["Enums"]["import_type"]
          user_id?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          erros?: Json | null
          id?: string
          registros_duplicados?: number
          registros_erro?: number
          registros_ok?: number
          registros_total?: number
          resumo?: Json | null
          status?: string
          tipo?: Database["public"]["Enums"]["import_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      inventories: {
        Row: {
          aberto_em: string
          descricao: string
          escopo: string
          fechado_em: string | null
          id: string
          status: string
          user_id: string | null
        }
        Insert: {
          aberto_em?: string
          descricao: string
          escopo?: string
          fechado_em?: string | null
          id?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          aberto_em?: string
          descricao?: string
          escopo?: string
          fechado_em?: string | null
          id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          ajustado: boolean
          created_at: string
          diferenca: number | null
          id: string
          inventory_id: string
          product_id: string
          quantidade_contada: number | null
          quantidade_sistema: number
        }
        Insert: {
          ajustado?: boolean
          created_at?: string
          diferenca?: number | null
          id?: string
          inventory_id: string
          product_id: string
          quantidade_contada?: number | null
          quantidade_sistema: number
        }
        Update: {
          ajustado?: boolean
          created_at?: string
          diferenca?: number | null
          id?: string
          inventory_id?: string
          product_id?: string
          quantidade_contada?: number | null
          quantidade_sistema?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      losses: {
        Row: {
          created_at: string
          custo_unitario: number | null
          data_evento: string
          foto_url: string | null
          id: string
          motivo: string
          observacoes: string | null
          product_id: string
          quantidade: number
          responsavel: string | null
          tipo: string
          user_id: string | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          data_evento?: string
          foto_url?: string | null
          id?: string
          motivo: string
          observacoes?: string | null
          product_id: string
          quantidade: number
          responsavel?: string | null
          tipo?: string
          user_id?: string | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          data_evento?: string
          foto_url?: string | null
          id?: string
          motivo?: string
          observacoes?: string | null
          product_id?: string
          quantidade?: number
          responsavel?: string | null
          tipo?: string
          user_id?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "losses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          preco_anterior: number | null
          preco_novo: number
          product_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          preco_anterior?: number | null
          preco_novo: number
          product_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          preco_anterior?: number | null
          preco_novo?: number
          product_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          created_at: string
          custo_unitario: number | null
          id: string
          lote: string | null
          product_id: string
          quantidade: number
          validade: string | null
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          lote?: string | null
          product_id: string
          quantidade?: number
          validade?: string | null
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          lote?: string | null
          product_id?: string
          quantidade?: number
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          codigo_barras: string | null
          codigo_interno: string | null
          created_at: string
          custo_medio: number
          custo_ultima_compra: number
          descricao: string | null
          estoque_atual: number
          estoque_maximo: number | null
          estoque_minimo: number
          fornecedor_id: string | null
          id: string
          imagem_url: string | null
          localizacao: string | null
          marca: string | null
          margem_atual: number | null
          markup_atual: number | null
          nome: string
          observacoes: string | null
          pendente_revisao: boolean
          preco_venda: number
          qtd_por_embalagem: number | null
          subcategoria: string | null
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          codigo_barras?: string | null
          codigo_interno?: string | null
          created_at?: string
          custo_medio?: number
          custo_ultima_compra?: number
          descricao?: string | null
          estoque_atual?: number
          estoque_maximo?: number | null
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          imagem_url?: string | null
          localizacao?: string | null
          marca?: string | null
          margem_atual?: number | null
          markup_atual?: number | null
          nome: string
          observacoes?: string | null
          pendente_revisao?: boolean
          preco_venda?: number
          qtd_por_embalagem?: number | null
          subcategoria?: string | null
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          codigo_barras?: string | null
          codigo_interno?: string | null
          created_at?: string
          custo_medio?: number
          custo_ultima_compra?: number
          descricao?: string | null
          estoque_atual?: number
          estoque_maximo?: number | null
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          imagem_url?: string | null
          localizacao?: string | null
          marca?: string | null
          margem_atual?: number | null
          markup_atual?: number | null
          nome?: string
          observacoes?: string | null
          pendente_revisao?: boolean
          preco_venda?: number
          qtd_por_embalagem?: number | null
          subcategoria?: string | null
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          atualiza_preco: boolean
          codigo_barras: string | null
          created_at: string
          custo_total_unitario: number
          desconto: number
          descricao: string | null
          despesa_rateada: number
          frete_rateado: number
          id: string
          lote: string | null
          preco_venda_sugerido: number | null
          product_id: string | null
          purchase_id: string
          quantidade: number
          tributo_rateado: number
          unidade: string | null
          validade: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          atualiza_preco?: boolean
          codigo_barras?: string | null
          created_at?: string
          custo_total_unitario?: number
          desconto?: number
          descricao?: string | null
          despesa_rateada?: number
          frete_rateado?: number
          id?: string
          lote?: string | null
          preco_venda_sugerido?: number | null
          product_id?: string | null
          purchase_id: string
          quantidade: number
          tributo_rateado?: number
          unidade?: string | null
          validade?: string | null
          valor_total?: number
          valor_unitario: number
        }
        Update: {
          atualiza_preco?: boolean
          codigo_barras?: string | null
          created_at?: string
          custo_total_unitario?: number
          desconto?: number
          descricao?: string | null
          despesa_rateada?: number
          frete_rateado?: number
          id?: string
          lote?: string | null
          preco_venda_sugerido?: number | null
          product_id?: string | null
          purchase_id?: string
          quantidade?: number
          tributo_rateado?: number
          unidade?: string | null
          validade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          anexo_url: string | null
          chave_acesso: string | null
          created_at: string
          data_emissao: string | null
          data_entrada: string
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          numero_nota: string | null
          observacoes: string | null
          origem: string
          status: string
          updated_at: string
          user_id: string | null
          valor_descontos: number
          valor_despesas: number
          valor_frete: number
          valor_produtos: number
          valor_total: number
          valor_tributos: number
          xml_raw: string | null
        }
        Insert: {
          anexo_url?: string | null
          chave_acesso?: string | null
          created_at?: string
          data_emissao?: string | null
          data_entrada?: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_nota?: string | null
          observacoes?: string | null
          origem?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          valor_descontos?: number
          valor_despesas?: number
          valor_frete?: number
          valor_produtos?: number
          valor_total?: number
          valor_tributos?: number
          xml_raw?: string | null
        }
        Update: {
          anexo_url?: string | null
          chave_acesso?: string | null
          created_at?: string
          data_emissao?: string | null
          data_entrada?: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_nota?: string | null
          observacoes?: string | null
          origem?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          valor_descontos?: number
          valor_despesas?: number
          valor_frete?: number
          valor_produtos?: number
          valor_total?: number
          valor_tributos?: number
          xml_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          codigo_barras: string | null
          created_at: string
          custo_unitario: number
          desconto: number
          descricao: string | null
          id: string
          lucro: number
          preco_unitario: number
          product_id: string | null
          quantidade: number
          sale_id: string
          valor_total: number
        }
        Insert: {
          codigo_barras?: string | null
          created_at?: string
          custo_unitario?: number
          desconto?: number
          descricao?: string | null
          id?: string
          lucro?: number
          preco_unitario: number
          product_id?: string | null
          quantidade: number
          sale_id: string
          valor_total: number
        }
        Update: {
          codigo_barras?: string | null
          created_at?: string
          custo_unitario?: number
          desconto?: number
          descricao?: string | null
          id?: string
          lucro?: number
          preco_unitario?: number
          product_id?: string | null
          quantidade?: number
          sale_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          codigo_venda: string | null
          created_at: string
          custo_total: number
          data_venda: string
          forma_pagamento: string | null
          hash_dedupe: string | null
          id: string
          import_batch_id: string | null
          lucro_bruto: number
          numero_transacao: string | null
          operador: string | null
          valor_bruto: number
          valor_desconto: number
          valor_total: number
        }
        Insert: {
          codigo_venda?: string | null
          created_at?: string
          custo_total?: number
          data_venda: string
          forma_pagamento?: string | null
          hash_dedupe?: string | null
          id?: string
          import_batch_id?: string | null
          lucro_bruto?: number
          numero_transacao?: string | null
          operador?: string | null
          valor_bruto?: number
          valor_desconto?: number
          valor_total?: number
        }
        Update: {
          codigo_venda?: string | null
          created_at?: string
          custo_total?: number
          data_venda?: string
          forma_pagamento?: string | null
          hash_dedupe?: string | null
          id?: string
          import_batch_id?: string | null
          lucro_bruto?: number
          numero_transacao?: string | null
          operador?: string | null
          valor_bruto?: number
          valor_desconto?: number
          valor_total?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          cnpj: string | null
          endereco: string | null
          estoque_minimo_padrao: number
          id: number
          logo_url: string | null
          margem_minima: number
          margem_padrao: number
          markup_padrao: number
          metodo_custo: string
          nome_empresa: string
          perc_perdas: number
          permite_estoque_negativo: boolean
          regra_arredondamento: string
          taxa_cartao: number
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          endereco?: string | null
          estoque_minimo_padrao?: number
          id?: number
          logo_url?: string | null
          margem_minima?: number
          margem_padrao?: number
          markup_padrao?: number
          metodo_custo?: string
          nome_empresa?: string
          perc_perdas?: number
          permite_estoque_negativo?: boolean
          regra_arredondamento?: string
          taxa_cartao?: number
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          endereco?: string | null
          estoque_minimo_padrao?: number
          id?: number
          logo_url?: string | null
          margem_minima?: number
          margem_padrao?: number
          markup_padrao?: number
          metodo_custo?: string
          nome_empresa?: string
          perc_perdas?: number
          permite_estoque_negativo?: boolean
          regra_arredondamento?: string
          taxa_cartao?: number
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          custo_unitario: number | null
          documento_ref: string | null
          estoque_anterior: number
          estoque_posterior: number
          id: string
          motivo: string | null
          product_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["stock_movement_type"]
          user_id: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          custo_unitario?: number | null
          documento_ref?: string | null
          estoque_anterior: number
          estoque_posterior: number
          id?: string
          motivo?: string | null
          product_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          custo_unitario?: number | null
          documento_ref?: string | null
          estoque_anterior?: number
          estoque_posterior?: number
          id?: string
          motivo?: string | null
          product_id?: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          ativo: boolean
          cnpj: string | null
          condicoes_pagamento: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          observacoes: string | null
          prazo_entrega_dias: number | null
          razao_social: string
          telefone: string | null
          updated_at: string
          vendedor: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          condicoes_pagamento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          razao_social: string
          telefone?: string | null
          updated_at?: string
          vendedor?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          condicoes_pagamento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string
          vendedor?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_stock_movement: {
        Args: {
          _custo: number
          _documento_ref: string
          _motivo: string
          _product_id: string
          _quantidade: number
          _tipo: Database["public"]["Enums"]["stock_movement_type"]
        }
        Returns: string
      }
      can_read: { Args: never; Returns: boolean }
      can_write: { Args: never; Returns: boolean }
      current_user_has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "gerente" | "operador" | "consulta"
      import_type:
        | "estoque_inicial"
        | "estoque_substituir"
        | "estoque_ajustar"
        | "estoque_somar"
        | "vendas"
        | "nfe_xml"
      stock_movement_type:
        | "entrada_compra"
        | "saida_venda"
        | "ajuste"
        | "perda"
        | "avaria"
        | "vencimento"
        | "consumo_interno"
        | "bonificacao"
        | "devolucao_fornecedor"
        | "cancelamento_venda"
        | "inventario"
        | "transferencia"
        | "importacao_inicial"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gerente", "operador", "consulta"],
      import_type: [
        "estoque_inicial",
        "estoque_substituir",
        "estoque_ajustar",
        "estoque_somar",
        "vendas",
        "nfe_xml",
      ],
      stock_movement_type: [
        "entrada_compra",
        "saida_venda",
        "ajuste",
        "perda",
        "avaria",
        "vencimento",
        "consumo_interno",
        "bonificacao",
        "devolucao_fornecedor",
        "cancelamento_venda",
        "inventario",
        "transferencia",
        "importacao_inicial",
      ],
    },
  },
} as const
