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
          diagnostico_id: string | null
          id: string
          immersion_id: string | null
          observacoes: string | null
          perspectiva_origem_id: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["action_priority"]
          resolvido_em: string | null
          responsavel: string | null
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
        }
        Insert: {
          acao: string
          company_id?: string | null
          created_at?: string
          diagnostico_id?: string | null
          id?: string
          immersion_id?: string | null
          observacoes?: string | null
          perspectiva_origem_id?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["action_priority"]
          resolvido_em?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Update: {
          acao?: string
          company_id?: string | null
          created_at?: string
          diagnostico_id?: string | null
          id?: string
          immersion_id?: string | null
          observacoes?: string | null
          perspectiva_origem_id?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["action_priority"]
          resolvido_em?: string | null
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
            foreignKeyName: "action_plans_diagnostico_id_fkey"
            columns: ["diagnostico_id"]
            isOneToOne: false
            referencedRelation: "ai_compilations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_immersion_id_fkey"
            columns: ["immersion_id"]
            isOneToOne: false
            referencedRelation: "immersions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_perspectiva_origem_id_fkey"
            columns: ["perspectiva_origem_id"]
            isOneToOne: false
            referencedRelation: "perspectivas"
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
          escopo_ref_id: string | null
          escopo_tipo: Database["public"]["Enums"]["perspectiva_escopo"]
          id: string
          immersion_id: string | null
          modelo: string | null
          perspectivas_incluidas: string[]
          tipo: Database["public"]["Enums"]["ai_compilation_type"]
          versao: number | null
        }
        Insert: {
          company_id?: string | null
          conteudo: Json
          created_at?: string
          created_by?: string | null
          escopo_ref_id?: string | null
          escopo_tipo?: Database["public"]["Enums"]["perspectiva_escopo"]
          id?: string
          immersion_id?: string | null
          modelo?: string | null
          perspectivas_incluidas?: string[]
          tipo: Database["public"]["Enums"]["ai_compilation_type"]
          versao?: number | null
        }
        Update: {
          company_id?: string | null
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          escopo_ref_id?: string | null
          escopo_tipo?: Database["public"]["Enums"]["perspectiva_escopo"]
          id?: string
          immersion_id?: string | null
          modelo?: string | null
          perspectivas_incluidas?: string[]
          tipo?: Database["public"]["Enums"]["ai_compilation_type"]
          versao?: number | null
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
      backup_auditoria: {
        Row: {
          baixos: number
          created_at: string
          graves: number
          id: string
          medios: number
          relatorio: Json
          status: string
        }
        Insert: {
          baixos?: number
          created_at?: string
          graves?: number
          id?: string
          medios?: number
          relatorio?: Json
          status: string
        }
        Update: {
          baixos?: number
          created_at?: string
          graves?: number
          id?: string
          medios?: number
          relatorio?: Json
          status?: string
        }
        Relationships: []
      }
      backup_config: {
        Row: {
          auto_backup: boolean
          created_at: string
          frequencia: string
          github_branch: string
          github_repo: string | null
          horario_execucao: string
          id: string
          limite_gb: number
          retencao_dias: number
          updated_at: string
        }
        Insert: {
          auto_backup?: boolean
          created_at?: string
          frequencia?: string
          github_branch?: string
          github_repo?: string | null
          horario_execucao?: string
          id?: string
          limite_gb?: number
          retencao_dias?: number
          updated_at?: string
        }
        Update: {
          auto_backup?: boolean
          created_at?: string
          frequencia?: string
          github_branch?: string
          github_repo?: string | null
          horario_execucao?: string
          id?: string
          limite_gb?: number
          retencao_dias?: number
          updated_at?: string
        }
        Relationships: []
      }
      backup_historico: {
        Row: {
          created_at: string
          detalhe: string | null
          id: string
          job_id: string | null
          operacao: string
          resultado: string
          usuario_label: string | null
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          id?: string
          job_id?: string | null
          operacao: string
          resultado?: string
          usuario_label?: string | null
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          id?: string
          job_id?: string | null
          operacao?: string
          resultado?: string
          usuario_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_historico_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "backup_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_jobs: {
        Row: {
          concluido_em: string | null
          created_at: string
          erro: string | null
          id: string
          iniciado_por: string | null
          origem: string
          status: string
          storage_path: string | null
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          iniciado_por?: string | null
          origem?: string
          status?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo: string
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          iniciado_por?: string | null
          origem?: string
          status?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: []
      }
      capitulos: {
        Row: {
          campos_matriz: Json
          codigo: string
          created_at: string
          hipotese: string | null
          id: string
          lente_default: Database["public"]["Enums"]["perspectiva_lente"] | null
          ordem: number
          orientacao: string | null
          pergunta_abertura: string | null
          pontos_escuta: string[] | null
          roteiro_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          campos_matriz?: Json
          codigo: string
          created_at?: string
          hipotese?: string | null
          id?: string
          lente_default?:
            | Database["public"]["Enums"]["perspectiva_lente"]
            | null
          ordem: number
          orientacao?: string | null
          pergunta_abertura?: string | null
          pontos_escuta?: string[] | null
          roteiro_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          campos_matriz?: Json
          codigo?: string
          created_at?: string
          hipotese?: string | null
          id?: string
          lente_default?:
            | Database["public"]["Enums"]["perspectiva_lente"]
            | null
          ordem?: number
          orientacao?: string | null
          pergunta_abertura?: string | null
          pontos_escuta?: string[] | null
          roteiro_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capitulos_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "roteiros"
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
          familia_id: string | null
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
          familia_id?: string | null
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
          familia_id?: string | null
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
          {
            foreignKeyName: "competitor_products_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias_produto"
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
      event_orders: {
        Row: {
          confirmation_email_sent_at: string | null
          created_at: string
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          pacote: string
          pacote_titulo: string
          paid_at: string | null
          participante_email: string
          participante_nome: string
          participante_telefone: string | null
          payment_method: string | null
          raw: Json | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          confirmation_email_sent_at?: string | null
          created_at?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          pacote: string
          pacote_titulo: string
          paid_at?: string | null
          participante_email: string
          participante_nome: string
          participante_telefone?: string | null
          payment_method?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          confirmation_email_sent_at?: string | null
          created_at?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          pacote?: string
          pacote_titulo?: string
          paid_at?: string | null
          participante_email?: string
          participante_nome?: string
          participante_telefone?: string | null
          payment_method?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      event_orders_test: {
        Row: {
          confirmation_email_sent_at: string | null
          created_at: string
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          pacote: string
          pacote_titulo: string
          paid_at: string | null
          participante_email: string
          participante_nome: string
          participante_telefone: string | null
          payment_method: string | null
          raw: Json | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          confirmation_email_sent_at?: string | null
          created_at?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          pacote: string
          pacote_titulo: string
          paid_at?: string | null
          participante_email: string
          participante_nome: string
          participante_telefone?: string | null
          payment_method?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          confirmation_email_sent_at?: string | null
          created_at?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          pacote?: string
          pacote_titulo?: string
          paid_at?: string | null
          participante_email?: string
          participante_nome?: string
          participante_telefone?: string | null
          payment_method?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      familias_produto: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          id: string
          nivel: Database["public"]["Enums"]["familia_nivel"]
          nome: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          id?: string
          nivel: Database["public"]["Enums"]["familia_nivel"]
          nome: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          id?: string
          nivel?: Database["public"]["Enums"]["familia_nivel"]
          nome?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "familias_produto_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familias_produto_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "familias_produto"
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
      gerador_performance_salvos: {
        Row: {
          created_at: string
          familias: Json
          id: string
          nome: string
          observacoes: string | null
          participacao: Json
          periodo_fim: string | null
          periodo_inicio: string | null
          periodo_label: string | null
          representante: string | null
          rows: Json
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          familias?: Json
          id?: string
          nome: string
          observacoes?: string | null
          participacao?: Json
          periodo_fim?: string | null
          periodo_inicio?: string | null
          periodo_label?: string | null
          representante?: string | null
          rows?: Json
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          familias?: Json
          id?: string
          nome?: string
          observacoes?: string | null
          participacao?: Json
          periodo_fim?: string | null
          periodo_inicio?: string | null
          periodo_label?: string | null
          representante?: string | null
          rows?: Json
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
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
          roteiro_id: string | null
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
          roteiro_id?: string | null
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
          roteiro_id?: string | null
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
          {
            foreignKeyName: "immersions_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "roteiros"
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
          immersion_id: string | null
          modo_captura: string | null
          observacoes: string | null
          perfil: string | null
          perfil_outro: string | null
          respostas: Json
          roteiro_id: string | null
          status_revisao: Database["public"]["Enums"]["capitulo_status_revisao"]
          tipo: string | null
          transcricao_bruta: string | null
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
          immersion_id?: string | null
          modo_captura?: string | null
          observacoes?: string | null
          perfil?: string | null
          perfil_outro?: string | null
          respostas?: Json
          roteiro_id?: string | null
          status_revisao?: Database["public"]["Enums"]["capitulo_status_revisao"]
          tipo?: string | null
          transcricao_bruta?: string | null
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
          immersion_id?: string | null
          modo_captura?: string | null
          observacoes?: string | null
          perfil?: string | null
          perfil_outro?: string | null
          respostas?: Json
          roteiro_id?: string | null
          status_revisao?: Database["public"]["Enums"]["capitulo_status_revisao"]
          tipo?: string | null
          transcricao_bruta?: string | null
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
          {
            foreignKeyName: "interviews_immersion_id_fkey"
            columns: ["immersion_id"]
            isOneToOne: false
            referencedRelation: "immersions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "roteiros"
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
          familia_id: string | null
          gru_in_codigo: number | null
          gru_nome: string | null
          id: string
          imagem_url: string | null
          ipi: number | null
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
          familia_id?: string | null
          gru_in_codigo?: number | null
          gru_nome?: string | null
          id?: string
          imagem_url?: string | null
          ipi?: number | null
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
          familia_id?: string | null
          gru_in_codigo?: number | null
          gru_nome?: string | null
          id?: string
          imagem_url?: string | null
          ipi?: number | null
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
          {
            foreignKeyName: "own_products_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      perspectivas: {
        Row: {
          aprovada_em: string | null
          aprovada_por: string | null
          capitulo_id: string | null
          company_id: string
          conteudo: Json
          created_at: string
          escopo_ref_id: string | null
          escopo_tipo: Database["public"]["Enums"]["perspectiva_escopo"]
          id: string
          item_ref_id: string | null
          item_ref_tipo: string | null
          lente: Database["public"]["Enums"]["perspectiva_lente"]
          origem: string
          sessao_capitulo_id: string | null
          sessao_id: string | null
          status: Database["public"]["Enums"]["perspectiva_status"]
          updated_at: string
        }
        Insert: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          capitulo_id?: string | null
          company_id: string
          conteudo?: Json
          created_at?: string
          escopo_ref_id?: string | null
          escopo_tipo: Database["public"]["Enums"]["perspectiva_escopo"]
          id?: string
          item_ref_id?: string | null
          item_ref_tipo?: string | null
          lente: Database["public"]["Enums"]["perspectiva_lente"]
          origem?: string
          sessao_capitulo_id?: string | null
          sessao_id?: string | null
          status?: Database["public"]["Enums"]["perspectiva_status"]
          updated_at?: string
        }
        Update: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          capitulo_id?: string | null
          company_id?: string
          conteudo?: Json
          created_at?: string
          escopo_ref_id?: string | null
          escopo_tipo?: Database["public"]["Enums"]["perspectiva_escopo"]
          id?: string
          item_ref_id?: string | null
          item_ref_tipo?: string | null
          lente?: Database["public"]["Enums"]["perspectiva_lente"]
          origem?: string
          sessao_capitulo_id?: string | null
          sessao_id?: string | null
          status?: Database["public"]["Enums"]["perspectiva_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perspectivas_capitulo_id_fkey"
            columns: ["capitulo_id"]
            isOneToOne: false
            referencedRelation: "capitulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perspectivas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perspectivas_sessao_capitulo_id_fkey"
            columns: ["sessao_capitulo_id"]
            isOneToOne: false
            referencedRelation: "sessao_capitulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perspectivas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "interviews"
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
      rep_bi_uploads: {
        Row: {
          company_id: string
          created_at: string
          data: Json
          filename: string | null
          id: string
          periodo_label: string
          representative_id: string
          substituida_em: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          data: Json
          filename?: string | null
          id?: string
          periodo_label: string
          representative_id: string
          substituida_em?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          data?: Json
          filename?: string | null
          id?: string
          periodo_label?: string
          representative_id?: string
          substituida_em?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_bi_uploads_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_performance_rows: {
        Row: {
          acompanhar: boolean
          categoria: string | null
          company_id: string
          created_at: string
          id: string
          metas: Json
          metas_cores: Json
          metas_status: Json
          observacao: string | null
          ordem: number
          razao_social: string
          realizado: Json
          total_meta: number | null
          total_pct_status: string | null
          upload_id: string
        }
        Insert: {
          acompanhar?: boolean
          categoria?: string | null
          company_id: string
          created_at?: string
          id?: string
          metas?: Json
          metas_cores?: Json
          metas_status?: Json
          observacao?: string | null
          ordem?: number
          razao_social: string
          realizado?: Json
          total_meta?: number | null
          total_pct_status?: string | null
          upload_id: string
        }
        Update: {
          acompanhar?: boolean
          categoria?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metas?: Json
          metas_cores?: Json
          metas_status?: Json
          observacao?: string | null
          ordem?: number
          razao_social?: string
          realizado?: Json
          total_meta?: number | null
          total_pct_status?: string | null
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_performance_rows_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "rep_performance_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_performance_uploads: {
        Row: {
          atingimento: Json | null
          categoria_metas: Json
          company_id: string
          created_at: string
          escala_percentual: Json
          familias: string[]
          filename: string | null
          id: string
          observacao: string | null
          origem: string
          participacao: Json | null
          periodo_fim: string | null
          periodo_inicio: string | null
          periodo_label: string
          representative_id: string
          substituida_em: string | null
          substituida_por: string | null
          updated_at: string
          updated_by: string | null
          uploaded_by: string | null
        }
        Insert: {
          atingimento?: Json | null
          categoria_metas?: Json
          company_id: string
          created_at?: string
          escala_percentual?: Json
          familias?: string[]
          filename?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          participacao?: Json | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          periodo_label: string
          representative_id: string
          substituida_em?: string | null
          substituida_por?: string | null
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
        }
        Update: {
          atingimento?: Json | null
          categoria_metas?: Json
          company_id?: string
          created_at?: string
          escala_percentual?: Json
          familias?: string[]
          filename?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          participacao?: Json | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          periodo_label?: string
          representative_id?: string
          substituida_em?: string | null
          substituida_por?: string | null
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_performance_uploads_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_performance_uploads_substituida_por_fkey"
            columns: ["substituida_por"]
            isOneToOne: false
            referencedRelation: "rep_performance_uploads"
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
          representacao: string | null
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
          representacao?: string | null
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
          representacao?: string | null
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
      roteiro_perfis: {
        Row: {
          company_id: string | null
          created_at: string
          perfil: string
          roteiro_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          perfil: string
          roteiro_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          perfil?: string
          roteiro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roteiro_perfis_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "roteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      roteiros: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          perfil_alvo: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          perfil_alvo?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          perfil_alvo?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "roteiros_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_capitulo_itens: {
        Row: {
          campos: Json
          company_id: string | null
          confianca_ia: number | null
          created_at: string
          id: string
          item_ref_id: string | null
          item_tipo: string | null
          origem: string
          revisado_humano: boolean
          sessao_capitulo_id: string
          updated_at: string
        }
        Insert: {
          campos?: Json
          company_id?: string | null
          confianca_ia?: number | null
          created_at?: string
          id?: string
          item_ref_id?: string | null
          item_tipo?: string | null
          origem: string
          revisado_humano?: boolean
          sessao_capitulo_id: string
          updated_at?: string
        }
        Update: {
          campos?: Json
          company_id?: string | null
          confianca_ia?: number | null
          created_at?: string
          id?: string
          item_ref_id?: string | null
          item_tipo?: string | null
          origem?: string
          revisado_humano?: boolean
          sessao_capitulo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessao_capitulo_itens_sessao_capitulo_id_fkey"
            columns: ["sessao_capitulo_id"]
            isOneToOne: false
            referencedRelation: "sessao_capitulos"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_capitulos: {
        Row: {
          capitulo_id: string
          company_id: string
          created_at: string
          id: string
          leitura_estrategica: string | null
          origem: string
          resposta_texto: string | null
          revisado_em: string | null
          revisado_por: string | null
          sessao_id: string
          sintese: Json
          status_revisao: Database["public"]["Enums"]["capitulo_status_revisao"]
          updated_at: string
        }
        Insert: {
          capitulo_id: string
          company_id: string
          created_at?: string
          id?: string
          leitura_estrategica?: string | null
          origem?: string
          resposta_texto?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          sessao_id: string
          sintese?: Json
          status_revisao?: Database["public"]["Enums"]["capitulo_status_revisao"]
          updated_at?: string
        }
        Update: {
          capitulo_id?: string
          company_id?: string
          created_at?: string
          id?: string
          leitura_estrategica?: string | null
          origem?: string
          resposta_texto?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          sessao_id?: string
          sintese?: Json
          status_revisao?: Database["public"]["Enums"]["capitulo_status_revisao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessao_capitulos_capitulo_id_fkey"
            columns: ["capitulo_id"]
            isOneToOne: false
            referencedRelation: "capitulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_capitulos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_capitulos_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          author_id: string
          author_name: string | null
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name?: string | null
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
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
      list_storage_objects: {
        Args: never
        Returns: {
          bucket_id: string
          mimetype: string
          name: string
          size: number
          updated_at: string
        }[]
      }
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
      app_role: "admin" | "gestor" | "agente" | "comercial"
      capitulo_status_revisao:
        | "pendente"
        | "em_revisao"
        | "revisado"
        | "descartado"
      client_category: "Black" | "Gold" | "Silver"
      client_group: "G1" | "G2" | "G2+" | "Corporativo"
      client_status: "ativo" | "inativo" | "prospect"
      equivalence_grade: "igual" | "similar" | "substituto"
      familia_nivel:
        | "familia"
        | "sub_familia"
        | "linha"
        | "portfolio"
        | "sub_portfolio"
      immersion_status:
        | "planejada"
        | "antes_visita"
        | "visita_campo"
        | "em_diagnostico"
        | "diagnostico_gerado"
        | "plano_acao"
        | "concluida"
      perspectiva_escopo: "cliente" | "familia" | "competidor" | "empresa"
      perspectiva_lente:
        | "percepcao_marca"
        | "mix"
        | "concorrencia"
        | "argumento"
        | "decisao"
        | "familias"
        | "promo_comercial"
        | "oportunidade"
        | "ameaca"
        | "cuidado"
        | "governanca"
      perspectiva_status:
        | "ia_sugerida"
        | "em_revisao"
        | "aprovada"
        | "descartada"
        | "aguardando_revisao"
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
      app_role: ["admin", "gestor", "agente", "comercial"],
      capitulo_status_revisao: [
        "pendente",
        "em_revisao",
        "revisado",
        "descartado",
      ],
      client_category: ["Black", "Gold", "Silver"],
      client_group: ["G1", "G2", "G2+", "Corporativo"],
      client_status: ["ativo", "inativo", "prospect"],
      equivalence_grade: ["igual", "similar", "substituto"],
      familia_nivel: [
        "familia",
        "sub_familia",
        "linha",
        "portfolio",
        "sub_portfolio",
      ],
      immersion_status: [
        "planejada",
        "antes_visita",
        "visita_campo",
        "em_diagnostico",
        "diagnostico_gerado",
        "plano_acao",
        "concluida",
      ],
      perspectiva_escopo: ["cliente", "familia", "competidor", "empresa"],
      perspectiva_lente: [
        "percepcao_marca",
        "mix",
        "concorrencia",
        "argumento",
        "decisao",
        "familias",
        "promo_comercial",
        "oportunidade",
        "ameaca",
        "cuidado",
        "governanca",
      ],
      perspectiva_status: [
        "ia_sugerida",
        "em_revisao",
        "aprovada",
        "descartada",
        "aguardando_revisao",
      ],
    },
  },
} as const
