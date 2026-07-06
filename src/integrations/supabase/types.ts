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
      action_plans: {
        Row: {
          acao: string
          company_id: string | null
          created_at: string
          id: string
          immersion_id: string
          observacoes: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["action_priority"]
          responsavel: string | null
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
        }
        Insert: {
          acao: string
          company_id?: string | null
          created_at?: string
          id?: string
          immersion_id: string
          observacoes?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["action_priority"]
          responsavel?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Update: {
          acao?: string
          company_id?: string | null
          created_at?: string
          id?: string
          immersion_id?: string
          observacoes?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["action_priority"]
          responsavel?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_immersion_id_fkey"
            columns: ["immersion_id"]
            isOneToOne: false
            referencedRelation: "immersions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_compilations: {
        Row: {
          company_id: string | null
          conteudo: Json
          created_at: string
          created_by: string | null
          id: string
          immersion_id: string | null
          modelo: string | null
          tipo: Database["public"]["Enums"]["ai_compilation_type"]
        }
        Insert: {
          company_id?: string | null
          conteudo: Json
          created_at?: string
          created_by?: string | null
          id?: string
          immersion_id?: string | null
          modelo?: string | null
          tipo: Database["public"]["Enums"]["ai_compilation_type"]
        }
        Update: {
          company_id?: string | null
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          immersion_id?: string | null
          modelo?: string | null
          tipo?: Database["public"]["Enums"]["ai_compilation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_compilations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_compilations_immersion_id_fkey"
            columns: ["immersion_id"]
            isOneToOne: false
            referencedRelation: "immersions"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agente_id: string | null
          assistente: string | null
          bai_entrega: string | null
          bairro: string | null
          categoria: Database["public"]["Enums"]["client_category"] | null
          categoria_erp: string | null
          cep: string | null
          cep_entrega: string | null
          cidade: string | null
          cnpj: string | null
          cod_representante: string | null
          cod_tabela_nl: string | null
          cod_tabela_sd: string | null
          cod_tabela_st: string | null
          cod_transportadora: string | null
          codigo_alternativo: string | null
          codigo_erp: string | null
          company_id: string | null
          complemento: string | null
          cond_pagamento: string | null
          conso_codigo: string | null
          conso_nome: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_cadastro_erp: string | null
          desc_tabela_nl: string | null
          desc_tabela_sd: string | null
          desc_tabela_st: string | null
          desc_transportadora: string | null
          documento: string | null
          email: string | null
          end_entrega: string | null
          endereco: string | null
          estado: string | null
          fisica_juridica: string | null
          grupo: Database["public"]["Enums"]["client_group"] | null
          grupo_erp: string | null
          grupo_nome: string | null
          id: string
          info_comerciais: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          mun_entrega: string | null
          municipio: string | null
          nome_comprador: string | null
          nome_fantasia: string
          nome_representante_erp: string | null
          num_entrega: string | null
          numero_endereco: string | null
          obs_cliente: string | null
          observacoes: string | null
          outro_email: string | null
          pais: string | null
          pertence_grupo: boolean
          razao_social: string | null
          regiao: string | null
          representative_id: string | null
          rota: string | null
          rua_entrega: string | null
          sigla_endereco: string | null
          status: Database["public"]["Enums"]["client_status"]
          status_erp: string | null
          suframa: string | null
          telefone: string | null
          tipo_end_entrega: string | null
          tipo_frete: string | null
          uf_entrega: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          agente_id?: string | null
          assistente?: string | null
          bai_entrega?: string | null
          bairro?: string | null
          categoria?: Database["public"]["Enums"]["client_category"] | null
          categoria_erp?: string | null
          cep?: string | null
          cep_entrega?: string | null
          cidade?: string | null
          cnpj?: string | null
          cod_representante?: string | null
          cod_tabela_nl?: string | null
          cod_tabela_sd?: string | null
          cod_tabela_st?: string | null
          cod_transportadora?: string | null
          codigo_alternativo?: string | null
          codigo_erp?: string | null
          company_id?: string | null
          complemento?: string | null
          cond_pagamento?: string | null
          conso_codigo?: string | null
          conso_nome?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_cadastro_erp?: string | null
          desc_tabela_nl?: string | null
          desc_tabela_sd?: string | null
          desc_tabela_st?: string | null
          desc_transportadora?: string | null
          documento?: string | null
          email?: string | null
          end_entrega?: string | null
          endereco?: string | null
          estado?: string | null
          fisica_juridica?: string | null
          grupo?: Database["public"]["Enums"]["client_group"] | null
          grupo_erp?: string | null
          grupo_nome?: string | null
          id?: string
          info_comerciais?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          mun_entrega?: string | null
          municipio?: string | null
          nome_comprador?: string | null
          nome_fantasia: string
          nome_representante_erp?: string | null
          num_entrega?: string | null
          numero_endereco?: string | null
          obs_cliente?: string | null
          observacoes?: string | null
          outro_email?: string | null
          pais?: string | null
          pertence_grupo?: boolean
          razao_social?: string | null
          regiao?: string | null
          representative_id?: string | null
          rota?: string | null
          rua_entrega?: string | null
          sigla_endereco?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          status_erp?: string | null
          suframa?: string | null
          telefone?: string | null
          tipo_end_entrega?: string | null
          tipo_frete?: string | null
          uf_entrega?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          agente_id?: string | null
          assistente?: string | null
          bai_entrega?: string | null
          bairro?: string | null
          categoria?: Database["public"]["Enums"]["client_category"] | null
          categoria_erp?: string | null
          cep?: string | null
          cep_entrega?: string | null
          cidade?: string | null
          cnpj?: string | null
          cod_representante?: string | null
          cod_tabela_nl?: string | null
          cod_tabela_sd?: string | null
          cod_tabela_st?: string | null
          cod_transportadora?: string | null
          codigo_alternativo?: string | null
          codigo_erp?: string | null
          company_id?: string | null
          complemento?: string | null
          cond_pagamento?: string | null
          conso_codigo?: string | null
          conso_nome?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_cadastro_erp?: string | null
          desc_tabela_nl?: string | null
          desc_tabela_sd?: string | null
          desc_tabela_st?: string | null
          desc_transportadora?: string | null
          documento?: string | null
          email?: string | null
          end_entrega?: string | null
          endereco?: string | null
          estado?: string | null
          fisica_juridica?: string | null
          grupo?: Database["public"]["Enums"]["client_group"] | null
          grupo_erp?: string | null
          grupo_nome?: string | null
          id?: string
          info_comerciais?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          mun_entrega?: string | null
          municipio?: string | null
          nome_comprador?: string | null
          nome_fantasia?: string
          nome_representante_erp?: string | null
          num_entrega?: string | null
          numero_endereco?: string | null
          obs_cliente?: string | null
          observacoes?: string | null
          outro_email?: string | null
          pais?: string | null
          pertence_grupo?: boolean
          razao_social?: string | null
          regiao?: string | null
          representative_id?: string | null
          rota?: string | null
          rua_entrega?: string | null
          sigla_endereco?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          status_erp?: string | null
          suframa?: string | null
          telefone?: string | null
          tipo_end_entrega?: string | null
          tipo_frete?: string | null
          uf_entrega?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          estado: string | null
          id: string
          logradouro: string | null
          nome: string
          numero: string | null
          pais: string | null
          razao_social: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome: string
          numero?: string | null
          pais?: string | null
          razao_social?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome?: string
          numero?: string | null
          pais?: string | null
          razao_social?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      competitor_products: {
        Row: {
          arquivo_origem: string | null
          categoria: string | null
          codigo: string | null
          company_id: string | null
          competitor_id: string
          created_at: string
          data_tabela: string | null
          familia: string | null
          id: string
          nome: string
          preco_informado: number | null
          updated_at: string
        }
        Insert: {
          arquivo_origem?: string | null
          categoria?: string | null
          codigo?: string | null
          company_id?: string | null
          competitor_id: string
          created_at?: string
          data_tabela?: string | null
          familia?: string | null
          id?: string
          nome: string
          preco_informado?: number | null
          updated_at?: string
        }
        Update: {
          arquivo_origem?: string | null
          categoria?: string | null
          codigo?: string | null
          company_id?: string | null
          competitor_id?: string
          created_at?: string
          data_tabela?: string | null
          familia?: string | null
          id?: string
          nome?: string
          preco_informado?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_products_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "price_competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_permissions: {
        Row: {
          allowed: boolean
          area: string
          company_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          area: string
          company_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          area?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      field_visit_inputs: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          immersion_id: string
          observacoes_comerciais: string | null
          observacoes_concorrentes: string | null
          observacoes_exposicao: string | null
          observacoes_loja: string | null
          oportunidades: string | null
          scope: string
          texto: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          immersion_id: string
          observacoes_comerciais?: string | null
          observacoes_concorrentes?: string | null
          observacoes_exposicao?: string | null
          observacoes_loja?: string | null
          oportunidades?: string | null
          scope?: string
          texto?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          immersion_id?: string
          observacoes_comerciais?: string | null
          observacoes_concorrentes?: string | null
          observacoes_exposicao?: string | null
          observacoes_loja?: string | null
          oportunidades?: string | null
          scope?: string
          texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_visit_inputs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_visit_inputs_immersion_id_fkey"
            columns: ["immersion_id"]
            isOneToOne: false
            referencedRelation: "immersions"
            referencedColumns: ["id"]
          },
        ]
      }
      immersions: {
        Row: {
          agente_id: string | null
          client_id: string
          company_id: string | null
          created_at: string
          created_by: string | null
          data_visita: string | null
          id: string
          observacoes: string | null
          representative_id: string | null
          representative_token: string | null
          representative_token_expires_at: string | null
          status: Database["public"]["Enums"]["immersion_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          agente_id?: string | null
          client_id: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_visita?: string | null
          id?: string
          observacoes?: string | null
          representative_id?: string | null
          representative_token?: string | null
          representative_token_expires_at?: string | null
          status?: Database["public"]["Enums"]["immersion_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          agente_id?: string | null
          client_id?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_visita?: string | null
          id?: string
          observacoes?: string | null
          representative_id?: string | null
          representative_token?: string | null
          representative_token_expires_at?: string | null
          status?: Database["public"]["Enums"]["immersion_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "immersions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "immersions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "immersions_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          cidade: string | null
          client_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          data_entrevista: string | null
          empresa_nome: string | null
          empresa_tipo: string | null
          empresa_tipo_outro: string | null
          entrevistado_classificacao: string
          entrevistado_classificacao_outro: string | null
          entrevistado_nome: string
          entrevistador_cargo: string | null
          entrevistador_email: string | null
          entrevistador_nome: string
          estado: string | null
          id: string
          observacoes: string | null
          perfil: string | null
          perfil_outro: string | null
          respostas: Json
          tema: string | null
          tema_outro: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_entrevista?: string | null
          empresa_nome?: string | null
          empresa_tipo?: string | null
          empresa_tipo_outro?: string | null
          entrevistado_classificacao: string
          entrevistado_classificacao_outro?: string | null
          entrevistado_nome: string
          entrevistador_cargo?: string | null
          entrevistador_email?: string | null
          entrevistador_nome: string
          estado?: string | null
          id?: string
          observacoes?: string | null
          perfil?: string | null
          perfil_outro?: string | null
          respostas?: Json
          tema?: string | null
          tema_outro?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_entrevista?: string | null
          empresa_nome?: string | null
          empresa_tipo?: string | null
          empresa_tipo_outro?: string | null
          entrevistado_classificacao?: string
          entrevistado_classificacao_outro?: string | null
          entrevistado_nome?: string
          entrevistador_cargo?: string | null
          entrevistador_email?: string | null
          entrevistador_nome?: string
          estado?: string | null
          id?: string
          observacoes?: string | null
          perfil?: string | null
          perfil_outro?: string | null
          respostas?: Json
          tema?: string | null
          tema_outro?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      own_products: {
        Row: {
          categoria: string | null
          classe_rentabilidade: string | null
          codigo_alternativo: string | null
          codigo_barra: string | null
          codigo_interno: string | null
          company_id: string | null
          created_at: string
          def_item: string | null
          familia: string | null
          gru_in_codigo: number | null
          gru_nome: string | null
          id: string
          linha: string | null
          linha_montagem: string | null
          marca: string | null
          narrativa: string | null
          nome: string
          observacoes: string | null
          planta_fabril: string | null
          portifolio: string | null
          preco_base: number | null
          pro_in_codigo: number | null
          pro_pad_in_codigo: number | null
          status: string | null
          sub_familia: string | null
          sub_portifolio: string | null
          tipo_produto: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          classe_rentabilidade?: string | null
          codigo_alternativo?: string | null
          codigo_barra?: string | null
          codigo_interno?: string | null
          company_id?: string | null
          created_at?: string
          def_item?: string | null
          familia?: string | null
          gru_in_codigo?: number | null
          gru_nome?: string | null
          id?: string
          linha?: string | null
          linha_montagem?: string | null
          marca?: string | null
          narrativa?: string | null
          nome: string
          observacoes?: string | null
          planta_fabril?: string | null
          portifolio?: string | null
          preco_base?: number | null
          pro_in_codigo?: number | null
          pro_pad_in_codigo?: number | null
          status?: string | null
          sub_familia?: string | null
          sub_portifolio?: string | null
          tipo_produto?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          classe_rentabilidade?: string | null
          codigo_alternativo?: string | null
          codigo_barra?: string | null
          codigo_interno?: string | null
          company_id?: string | null
          created_at?: string
          def_item?: string | null
          familia?: string | null
          gru_in_codigo?: number | null
          gru_nome?: string | null
          id?: string
          linha?: string | null
          linha_montagem?: string | null
          marca?: string | null
          narrativa?: string | null
          nome?: string
          observacoes?: string | null
          planta_fabril?: string | null
          portifolio?: string | null
          preco_base?: number | null
          pro_in_codigo?: number | null
          pro_pad_in_codigo?: number | null
          status?: string | null
          sub_familia?: string | null
          sub_portifolio?: string | null
          tipo_produto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "own_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      price_competitors: {
        Row: {
          categoria: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          observacoes: string | null
          regiao: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          regiao?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          regiao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_competitors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_equivalences: {
        Row: {
          company_id: string | null
          competitor_product_id: string
          created_at: string
          grau: Database["public"]["Enums"]["equivalence_grade"]
          id: string
          observacoes: string | null
          own_product_id: string
        }
        Insert: {
          company_id?: string | null
          competitor_product_id: string
          created_at?: string
          grau?: Database["public"]["Enums"]["equivalence_grade"]
          id?: string
          observacoes?: string | null
          own_product_id: string
        }
        Update: {
          company_id?: string | null
          competitor_product_id?: string
          created_at?: string
          grau?: Database["public"]["Enums"]["equivalence_grade"]
          id?: string
          observacoes?: string | null
          own_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_equivalences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_equivalences_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_equivalences_own_product_id_fkey"
            columns: ["own_product_id"]
            isOneToOne: false
            referencedRelation: "own_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_company_id: string | null
          cargo: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          nda_accepted_at: string | null
          nda_version: string | null
          observacoes: string | null
          phone: string | null
          regiao: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active_company_id?: string | null
          cargo?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          nda_accepted_at?: string | null
          nda_version?: string | null
          observacoes?: string | null
          phone?: string | null
          regiao?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active_company_id?: string | null
          cargo?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          nda_accepted_at?: string | null
          nda_version?: string | null
          observacoes?: string | null
          phone?: string | null
          regiao?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_company_id_fkey"
            columns: ["active_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      representative_inputs: {
        Row: {
          abordagem_diferente: string | null
          acoes_faturamento: string | null
          ameacas: string | null
          company_id: string | null
          created_at: string
          cuidados: string | null
          familias_mais_compradas: string | null
          id: string
          immersion_id: string
          marcas_concorrentes: string | null
          motivo_compra: string | null
          negociacao: string | null
          oportunidades: string | null
          percepcao_marca: string | null
          perfil_comprador: string | null
          potencial_aumento: string | null
          submitted_at: string | null
          texto_livre: string | null
          updated_at: string
        }
        Insert: {
          abordagem_diferente?: string | null
          acoes_faturamento?: string | null
          ameacas?: string | null
          company_id?: string | null
          created_at?: string
          cuidados?: string | null
          familias_mais_compradas?: string | null
          id?: string
          immersion_id: string
          marcas_concorrentes?: string | null
          motivo_compra?: string | null
          negociacao?: string | null
          oportunidades?: string | null
          percepcao_marca?: string | null
          perfil_comprador?: string | null
          potencial_aumento?: string | null
          submitted_at?: string | null
          texto_livre?: string | null
          updated_at?: string
        }
        Update: {
          abordagem_diferente?: string | null
          acoes_faturamento?: string | null
          ameacas?: string | null
          company_id?: string | null
          created_at?: string
          cuidados?: string | null
          familias_mais_compradas?: string | null
          id?: string
          immersion_id?: string
          marcas_concorrentes?: string | null
          motivo_compra?: string | null
          negociacao?: string | null
          oportunidades?: string | null
          percepcao_marca?: string | null
          perfil_comprador?: string | null
          potencial_aumento?: string | null
          submitted_at?: string | null
          texto_livre?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representative_inputs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representative_inputs_immersion_id_fkey"
            columns: ["immersion_id"]
            isOneToOne: false
            referencedRelation: "immersions"
            referencedColumns: ["id"]
          },
        ]
      }
      representatives: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          outras_marcas: string | null
          regiao: string | null
          telefone: string | null
          tempo_relacionamento: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          outras_marcas?: string | null
          regiao?: string | null
          telefone?: string | null
          tempo_relacionamento?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          outras_marcas?: string | null
          regiao?: string | null
          telefone?: string | null
          tempo_relacionamento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representatives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      current_company_id: { Args: never; Returns: string }
      get_immersion_by_token: {
        Args: { _token: string }
        Returns: {
          already_submitted: boolean
          client_name: string
          expires_at: string
          immersion_id: string
          representative_name: string
          titulo: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_gestor: { Args: { _user_id: string }; Returns: boolean }
      submit_representative_input: {
        Args: { _data: Json; _token: string }
        Returns: string
      }
    }
    Enums: {
      action_priority: "alta" | "media" | "baixa"
      action_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      ai_compilation_type:
        | "representante"
        | "visita"
        | "price"
        | "diagnostico_final"
      app_role: "admin" | "gestor" | "agente"
      client_category: "Black" | "Gold" | "Silver"
      client_group: "G1" | "G2" | "G2+" | "Corporativo"
      client_status: "ativo" | "inativo" | "prospect"
      equivalence_grade: "igual" | "similar" | "substituto"
      immersion_status:
        | "planejada"
        | "antes_visita"
        | "visita_campo"
        | "em_diagnostico"
        | "diagnostico_gerado"
        | "plano_acao"
        | "concluida"
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
      action_priority: ["alta", "media", "baixa"],
      action_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      ai_compilation_type: [
        "representante",
        "visita",
        "price",
        "diagnostico_final",
      ],
      app_role: ["admin", "gestor", "agente"],
      client_category: ["Black", "Gold", "Silver"],
      client_group: ["G1", "G2", "G2+", "Corporativo"],
      client_status: ["ativo", "inativo", "prospect"],
      equivalence_grade: ["igual", "similar", "substituto"],
      immersion_status: [
        "planejada",
        "antes_visita",
        "visita_campo",
        "em_diagnostico",
        "diagnostico_gerado",
        "plano_acao",
        "concluida",
      ],
    },
  },
} as const
