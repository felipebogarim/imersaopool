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
      admin_mfa_audit: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["admin_mfa_event"]
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["admin_mfa_event"]
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["admin_mfa_event"]
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      admin_mfa_policy: {
        Row: {
          created_at: string
          created_by: string | null
          enforcement_started_at: string | null
          grace_period_days: number
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enforcement_started_at?: string | null
          grace_period_days?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enforcement_started_at?: string | null
          grace_period_days?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      app_email_contact_group_members: {
        Row: {
          contact_id: string
          created_at: string | null
          group_id: string
          id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          group_id: string
          id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_email_contact_group_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "app_email_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_email_contact_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "app_email_contact_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      app_email_contact_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      app_email_contacts: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          tags: string[] | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      app_update_templates: {
        Row: {
          blocks: Json | null
          created_at: string | null
          farewell: string | null
          id: string
          intro: string | null
          name: string
          status: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          blocks?: Json | null
          created_at?: string | null
          farewell?: string | null
          id?: string
          intro?: string | null
          name: string
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          blocks?: Json | null
          created_at?: string | null
          farewell?: string | null
          id?: string
          intro?: string | null
          name?: string
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
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
      bloco_notes: {
        Row: {
          author_id: string
          author_name: string | null
          bloco_key: string
          content: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name?: string | null
          bloco_key: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          bloco_key?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
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
      client_bi_uploads: {
        Row: {
          company_id: string
          created_at: string
          data: Json
          filename: string | null
          id: string
          kind: string
          periodo_label: string | null
          razao_social: string
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
          kind: string
          periodo_label?: string | null
          razao_social: string
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
          kind?: string
          periodo_label?: string | null
          razao_social?: string
          representative_id?: string
          substituida_em?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_bi_uploads_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
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
      data_classifications: {
        Row: {
          base_legal: string | null
          created_at: string
          criado_por: string | null
          criptografia: string | null
          descricao: string | null
          dominio: string
          id: string
          observacoes: string | null
          responsavel: string | null
          retencao_dias: number | null
          sensibilidade: string
          tabelas: string[]
          updated_at: string
        }
        Insert: {
          base_legal?: string | null
          created_at?: string
          criado_por?: string | null
          criptografia?: string | null
          descricao?: string | null
          dominio: string
          id?: string
          observacoes?: string | null
          responsavel?: string | null
          retencao_dias?: number | null
          sensibilidade?: string
          tabelas?: string[]
          updated_at?: string
        }
        Update: {
          base_legal?: string | null
          created_at?: string
          criado_por?: string | null
          criptografia?: string | null
          descricao?: string | null
          dominio?: string
          id?: string
          observacoes?: string | null
          responsavel?: string | null
          retencao_dias?: number | null
          sensibilidade?: string
          tabelas?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      data_purge_requests: {
        Row: {
          created_at: string
          error_message: string | null
          executed_at: string
          id: string
          justificativa: string
          metadata: Json
          request_type: string
          requested_by: string
          requester_email: string
          status: string
          target_email: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          justificativa: string
          metadata?: Json
          request_type: string
          requested_by: string
          requester_email: string
          status?: string
          target_email: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          justificativa?: string
          metadata?: Json
          request_type?: string
          requested_by?: string
          requester_email?: string
          status?: string
          target_email?: string
          target_user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
      executive_report_actions: {
        Row: {
          area: string
          company_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          executive_report_id: string
          external_id: string
          history: Json
          id: string
          note: string | null
          ordem: number
          owner: string | null
          priority: string
          reject_reason: string | null
          source_decision_id: string | null
          status: string
          title: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          area?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          executive_report_id: string
          external_id: string
          history?: Json
          id?: string
          note?: string | null
          ordem?: number
          owner?: string | null
          priority?: string
          reject_reason?: string | null
          source_decision_id?: string | null
          status?: string
          title: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          area?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          executive_report_id?: string
          external_id?: string
          history?: Json
          id?: string
          note?: string | null
          ordem?: number
          owner?: string | null
          priority?: string
          reject_reason?: string | null
          source_decision_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_report_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_report_actions_executive_report_id_fkey"
            columns: ["executive_report_id"]
            isOneToOne: false
            referencedRelation: "executive_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_report_email_logs: {
        Row: {
          attach_pdf: boolean
          company_id: string | null
          error: string | null
          executive_report_id: string
          executive_report_version_id: string | null
          id: string
          recipients: Json
          sent_at: string
          sent_by: string | null
          sent_by_name: string | null
          status: string
          subject: string | null
        }
        Insert: {
          attach_pdf?: boolean
          company_id?: string | null
          error?: string | null
          executive_report_id: string
          executive_report_version_id?: string | null
          id?: string
          recipients?: Json
          sent_at?: string
          sent_by?: string | null
          sent_by_name?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          attach_pdf?: boolean
          company_id?: string | null
          error?: string | null
          executive_report_id?: string
          executive_report_version_id?: string | null
          id?: string
          recipients?: Json
          sent_at?: string
          sent_by?: string | null
          sent_by_name?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_report_email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_report_email_logs_executive_report_id_fkey"
            columns: ["executive_report_id"]
            isOneToOne: false
            referencedRelation: "executive_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_report_email_logs_executive_report_version_id_fkey"
            columns: ["executive_report_version_id"]
            isOneToOne: false
            referencedRelation: "executive_report_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_report_versions: {
        Row: {
          closed_at: string
          closed_by: string | null
          closed_by_name: string | null
          company_id: string | null
          executive_report_id: string
          id: string
          snapshot: Json
          version: number
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          closed_by_name?: string | null
          company_id?: string | null
          executive_report_id: string
          id?: string
          snapshot: Json
          version: number
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          closed_by_name?: string | null
          company_id?: string | null
          executive_report_id?: string
          id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "executive_report_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_report_versions_executive_report_id_fkey"
            columns: ["executive_report_id"]
            isOneToOne: false
            referencedRelation: "executive_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_reports: {
        Row: {
          brands_observed: Json
          client: Json
          company_id: string | null
          created_at: string
          created_by: string | null
          current_version: number
          decision_blocks: Json
          do_not_prioritize: Json
          email: Json
          executive_reading: string | null
          id: string
          immersion_report_id: string
          report_title: string | null
          source_filename: string | null
          source_schema: string | null
          status: string
          updated_at: string
          validation: Json
        }
        Insert: {
          brands_observed?: Json
          client?: Json
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          decision_blocks?: Json
          do_not_prioritize?: Json
          email?: Json
          executive_reading?: string | null
          id?: string
          immersion_report_id: string
          report_title?: string | null
          source_filename?: string | null
          source_schema?: string | null
          status?: string
          updated_at?: string
          validation?: Json
        }
        Update: {
          brands_observed?: Json
          client?: Json
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          decision_blocks?: Json
          do_not_prioritize?: Json
          email?: Json
          executive_reading?: string | null
          id?: string
          immersion_report_id?: string
          report_title?: string | null
          source_filename?: string | null
          source_schema?: string | null
          status?: string
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "executive_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_reports_immersion_report_id_fkey"
            columns: ["immersion_report_id"]
            isOneToOne: true
            referencedRelation: "field_immersion_v2_reports"
            referencedColumns: ["id"]
          },
        ]
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
      field_immersion_v2_reports: {
        Row: {
          client_name: string
          company_id: string | null
          content_markdown: string
          created_at: string
          created_by: string | null
          id: string
          schema_version: string
          source_filename: string
          structured_data: Json
          visit_date: string
        }
        Insert: {
          client_name: string
          company_id?: string | null
          content_markdown: string
          created_at?: string
          created_by?: string | null
          id?: string
          schema_version?: string
          source_filename: string
          structured_data: Json
          visit_date: string
        }
        Update: {
          client_name?: string
          company_id?: string | null
          content_markdown?: string
          created_at?: string
          created_by?: string | null
          id?: string
          schema_version?: string
          source_filename?: string
          structured_data?: Json
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_immersion_v2_reports_company_id_fkey"
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
      file_security_events: {
        Row: {
          bucket: string
          created_at: string
          evento: string
          id: string
          metadata: Json | null
          mimetype: string | null
          nivel_risco: string | null
          path: string
          tamanho_bytes: number | null
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          bucket: string
          created_at?: string
          evento: string
          id?: string
          metadata?: Json | null
          mimetype?: string | null
          nivel_risco?: string | null
          path: string
          tamanho_bytes?: number | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          evento?: string
          id?: string
          metadata?: Json | null
          mimetype?: string | null
          nivel_risco?: string | null
          path?: string
          tamanho_bytes?: number | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      first_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          token: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      form_responses: {
        Row: {
          answers: Json
          company_id: string
          form_id: string
          id: string
          ip: string | null
          submitted_at: string
          user_agent: string | null
        }
        Insert: {
          answers?: Json
          company_id: string
          form_id: string
          id?: string
          ip?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Update: {
          answers?: Json
          company_id?: string
          form_id?: string
          id?: string
          ip?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          prompt: string | null
          schema: Json
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          prompt?: string | null
          schema?: Json
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          prompt?: string | null
          schema?: Json
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gerador_performance_salvos: {
        Row: {
          categoria_metas: Json | null
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
          categoria_metas?: Json | null
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
          categoria_metas?: Json | null
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
      insight_fonte_lentes: {
        Row: {
          company_id: string | null
          created_at: string
          fonte_id: string
          highlights: Json
          id: string
          leitura_estrategica: string | null
          lente: Database["public"]["Enums"]["insight_lente"]
          sintese_campos: Json
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          fonte_id: string
          highlights?: Json
          id?: string
          leitura_estrategica?: string | null
          lente: Database["public"]["Enums"]["insight_lente"]
          sintese_campos?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          fonte_id?: string
          highlights?: Json
          id?: string
          leitura_estrategica?: string | null
          lente?: Database["public"]["Enums"]["insight_lente"]
          sintese_campos?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_fonte_lentes_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "insight_fontes"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_fontes: {
        Row: {
          arquivo_relatorio: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          data_coleta: string | null
          id: string
          interview_id: string | null
          perfil_carteira: string | null
          pessoa: string | null
          regiao: string | null
          status_processamento: Database["public"]["Enums"]["insight_fonte_status"]
          tipo: Database["public"]["Enums"]["insight_fonte_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivo_relatorio?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_coleta?: string | null
          id?: string
          interview_id?: string | null
          perfil_carteira?: string | null
          pessoa?: string | null
          regiao?: string | null
          status_processamento?: Database["public"]["Enums"]["insight_fonte_status"]
          tipo?: Database["public"]["Enums"]["insight_fonte_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivo_relatorio?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data_coleta?: string | null
          id?: string
          interview_id?: string | null
          perfil_carteira?: string | null
          pessoa?: string | null
          regiao?: string | null
          status_processamento?: Database["public"]["Enums"]["insight_fonte_status"]
          tipo?: Database["public"]["Enums"]["insight_fonte_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_fontes_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
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
      kanban_activities: {
        Row: {
          board_id: string
          card_id: string | null
          created_at: string
          id: string
          payload: Json
          type: Database["public"]["Enums"]["kanban_activity_type"]
          user_id: string | null
        }
        Insert: {
          board_id: string
          card_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          type: Database["public"]["Enums"]["kanban_activity_type"]
          user_id?: string | null
        }
        Update: {
          board_id?: string
          card_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          type?: Database["public"]["Enums"]["kanban_activity_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_activities_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_activities_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_attachments: {
        Row: {
          card_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_by: string
          url: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by: string
          url?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_automations: {
        Row: {
          action: Database["public"]["Enums"]["kanban_automation_action"]
          action_config: Json
          board_id: string
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          name: string
          trigger: Database["public"]["Enums"]["kanban_automation_trigger"]
          trigger_config: Json
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["kanban_automation_action"]
          action_config?: Json
          board_id: string
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          name: string
          trigger: Database["public"]["Enums"]["kanban_automation_trigger"]
          trigger_config?: Json
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["kanban_automation_action"]
          action_config?: Json
          board_id?: string
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          name?: string
          trigger?: Database["public"]["Enums"]["kanban_automation_trigger"]
          trigger_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_automations_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_boards: {
        Row: {
          archived_at: string | null
          color: string | null
          cover_image: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_template: boolean
          name: string
          position: number
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          cover_image?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
          position?: number
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
          position?: number
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_boards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "kanban_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_labels: {
        Row: {
          card_id: string
          label_id: string
        }
        Insert: {
          card_id: string
          label_id: string
        }
        Update: {
          card_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_labels_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_card_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "kanban_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_members: {
        Row: {
          assigned_at: string
          card_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          card_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          card_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_members_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards: {
        Row: {
          archived_at: string | null
          board_id: string
          completed_at: string | null
          cover_color: string | null
          cover_image: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          list_id: string
          metadata: Json
          origin_action_plan_id: string | null
          position: number
          priority: Database["public"]["Enums"]["kanban_card_priority"]
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          board_id: string
          completed_at?: string | null
          cover_color?: string | null
          cover_image?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          list_id: string
          metadata?: Json
          origin_action_plan_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["kanban_card_priority"]
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          board_id?: string
          completed_at?: string | null
          cover_color?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          list_id?: string
          metadata?: Json
          origin_action_plan_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["kanban_card_priority"]
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "kanban_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_origin_action_plan_id_fkey"
            columns: ["origin_action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_checklist_items: {
        Row: {
          assignee: string | null
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          content: string
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          position: number
        }
        Insert: {
          assignee?: string | null
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          content: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          position?: number
        }
        Update: {
          assignee?: string | null
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          content?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "kanban_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "kanban_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_checklists: {
        Row: {
          card_id: string
          created_at: string
          id: string
          position: number
          title: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          position?: number
          title: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_checklists_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_comments: {
        Row: {
          card_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          mentions: string[]
          user_id: string
        }
        Insert: {
          card_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          user_id: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_labels: {
        Row: {
          board_id: string
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          board_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_labels_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_lists: {
        Row: {
          archived_at: string | null
          board_id: string
          color: string | null
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          wip_limit: number | null
        }
        Insert: {
          archived_at?: string | null
          board_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          wip_limit?: number | null
        }
        Update: {
          archived_at?: string | null
          board_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_lists_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_notifications: {
        Row: {
          board_id: string | null
          body: string | null
          card_id: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          board_id?: string | null
          body?: string | null
          card_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          board_id?: string | null
          body?: string | null
          card_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_notifications_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_notifications_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["kanban_member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["kanban_member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["kanban_member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "kanban_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_workspaces: {
        Row: {
          archived_at: string | null
          color: string | null
          company_id: string | null
          created_at: string
          created_by: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_workspaces_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      manuais: {
        Row: {
          conteudo: Json
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          pdf_path: string | null
          prompt: string | null
          publicado: boolean
          slug: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          pdf_path?: string | null
          prompt?: string | null
          publicado?: boolean
          slug: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          pdf_path?: string | null
          prompt?: string | null
          publicado?: boolean
          slug?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      mapa_familia_versoes: {
        Row: {
          arquivo: string | null
          ativo: boolean
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          versao: number
        }
        Insert: {
          arquivo?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          payload: Json
          versao?: number
        }
        Update: {
          arquivo?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          versao?: number
        }
        Relationships: []
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
      paineis_sintese: {
        Row: {
          company_id: string | null
          corte_convergencia: number
          created_at: string
          created_by: string | null
          fontes_incluidas: string[]
          gerado_em: string
          id: string
          resultado: Json
          tipos_incluidos: Database["public"]["Enums"]["insight_fonte_tipo"][]
          titulo: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          company_id?: string | null
          corte_convergencia?: number
          created_at?: string
          created_by?: string | null
          fontes_incluidas?: string[]
          gerado_em?: string
          id?: string
          resultado?: Json
          tipos_incluidos: Database["public"]["Enums"]["insight_fonte_tipo"][]
          titulo?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          company_id?: string | null
          corte_convergencia?: number
          created_at?: string
          created_by?: string | null
          fontes_incluidas?: string[]
          gerado_em?: string
          id?: string
          resultado?: Json
          tipos_incluidos?: Database["public"]["Enums"]["insight_fonte_tipo"][]
          titulo?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      perf_acoes_sugeridas: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          linked_board_id: string | null
          linked_card_id: string | null
          representative_id: string
          source: string
          status: string
          title: string
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          linked_board_id?: string | null
          linked_card_id?: string | null
          representative_id: string
          source?: string
          status?: string
          title: string
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          linked_board_id?: string | null
          linked_card_id?: string | null
          representative_id?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perf_acoes_sugeridas_linked_board_id_fkey"
            columns: ["linked_board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perf_acoes_sugeridas_linked_card_id_fkey"
            columns: ["linked_card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perf_acoes_sugeridas_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perf_acoes_sugeridas_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "rep_performance_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_import_audit: {
        Row: {
          categorias: string[]
          clientes_validos: number
          company_id: string
          created_at: string
          descartes: Json
          divergencias: Json
          divergencias_texto_cor: number
          familias: string[]
          file_hash: string | null
          filename: string | null
          id: string
          linhas_ignoradas: number
          linhas_lidas: number
          matriz_erros: Json
          matriz_status: string
          mensagem: string | null
          parser_version: string | null
          performed_by: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          periodo_label: string | null
          representative_id: string | null
          status: string
          upload_id: string | null
        }
        Insert: {
          categorias?: string[]
          clientes_validos?: number
          company_id: string
          created_at?: string
          descartes?: Json
          divergencias?: Json
          divergencias_texto_cor?: number
          familias?: string[]
          file_hash?: string | null
          filename?: string | null
          id?: string
          linhas_ignoradas?: number
          linhas_lidas?: number
          matriz_erros?: Json
          matriz_status?: string
          mensagem?: string | null
          parser_version?: string | null
          performed_by?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          periodo_label?: string | null
          representative_id?: string | null
          status: string
          upload_id?: string | null
        }
        Update: {
          categorias?: string[]
          clientes_validos?: number
          company_id?: string
          created_at?: string
          descartes?: Json
          divergencias?: Json
          divergencias_texto_cor?: number
          familias?: string[]
          file_hash?: string | null
          filename?: string | null
          id?: string
          linhas_ignoradas?: number
          linhas_lidas?: number
          matriz_erros?: Json
          matriz_status?: string
          mensagem?: string | null
          parser_version?: string | null
          performed_by?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          periodo_label?: string | null
          representative_id?: string | null
          status?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_import_audit_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "rep_performance_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_presets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          nav_keys: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          nav_keys?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          nav_keys?: Json
          updated_at?: string
        }
        Relationships: []
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
      price_audit_logs: {
        Row: {
          action: string
          change_reason: string | null
          changed_by: string | null
          company_id: string
          created_at: string
          equivalence_id: string | null
          field_name: string | null
          id: string
          new_value: string | null
          previous_value: string | null
          product_id: string | null
        }
        Insert: {
          action: string
          change_reason?: string | null
          changed_by?: string | null
          company_id?: string
          created_at?: string
          equivalence_id?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          previous_value?: string | null
          product_id?: string | null
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_by?: string | null
          company_id?: string
          created_at?: string
          equivalence_id?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          previous_value?: string | null
          product_id?: string | null
        }
        Relationships: []
      }
      price_comparison_rules: {
        Row: {
          attribute_key: string
          attribute_name: string
          categoria: string
          company_id: string | null
          created_at: string
          familia: string
          id: string
          is_critical: boolean
          is_eliminatory: boolean
          missing_data_penalty: number
          tipo: string | null
          tolerance_approximate: number
          tolerance_direct: number
          updated_at: string
          weight: number
        }
        Insert: {
          attribute_key: string
          attribute_name: string
          categoria: string
          company_id?: string | null
          created_at?: string
          familia: string
          id?: string
          is_critical?: boolean
          is_eliminatory?: boolean
          missing_data_penalty?: number
          tipo?: string | null
          tolerance_approximate?: number
          tolerance_direct?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          attribute_key?: string
          attribute_name?: string
          categoria?: string
          company_id?: string | null
          created_at?: string
          familia?: string
          id?: string
          is_critical?: boolean
          is_eliminatory?: boolean
          missing_data_penalty?: number
          tipo?: string | null
          tolerance_approximate?: number
          tolerance_direct?: number
          updated_at?: string
          weight?: number
        }
        Relationships: []
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
      price_equivalences: {
        Row: {
          base_product_id: string
          calculation_version: string
          company_id: string
          compared_product_id: string
          cost_benefit_score: number | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          equivalence_level: Database["public"]["Enums"]["price_equivalence_level"]
          id: string
          incompatibility_reason: string | null
          is_deleted: boolean
          last_manual_edit_at: string | null
          last_manual_edit_by: string | null
          manually_edited: boolean
          price_score: number | null
          status: Database["public"]["Enums"]["price_equivalence_status"]
          technical_differences_json: Json
          technical_score: number | null
          technical_similarities_json: Json
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          warnings_json: Json
        }
        Insert: {
          base_product_id: string
          calculation_version?: string
          company_id?: string
          compared_product_id: string
          cost_benefit_score?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          equivalence_level?: Database["public"]["Enums"]["price_equivalence_level"]
          id?: string
          incompatibility_reason?: string | null
          is_deleted?: boolean
          last_manual_edit_at?: string | null
          last_manual_edit_by?: string | null
          manually_edited?: boolean
          price_score?: number | null
          status?: Database["public"]["Enums"]["price_equivalence_status"]
          technical_differences_json?: Json
          technical_score?: number | null
          technical_similarities_json?: Json
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          warnings_json?: Json
        }
        Update: {
          base_product_id?: string
          calculation_version?: string
          company_id?: string
          compared_product_id?: string
          cost_benefit_score?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          equivalence_level?: Database["public"]["Enums"]["price_equivalence_level"]
          id?: string
          incompatibility_reason?: string | null
          is_deleted?: boolean
          last_manual_edit_at?: string | null
          last_manual_edit_by?: string | null
          manually_edited?: boolean
          price_score?: number | null
          status?: Database["public"]["Enums"]["price_equivalence_status"]
          technical_differences_json?: Json
          technical_score?: number | null
          technical_similarities_json?: Json
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          warnings_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "price_equivalences_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "price_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_equivalences_compared_product_id_fkey"
            columns: ["compared_product_id"]
            isOneToOne: false
            referencedRelation: "price_products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_import_files: {
        Row: {
          company_id: string
          created_at: string
          document_type: string | null
          extraction_method: string | null
          file_name: string
          file_type: string | null
          id: string
          processed_at: string | null
          processing_status: Database["public"]["Enums"]["price_import_status"]
          report_json: Json
          storage_url: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          document_type?: string | null
          extraction_method?: string | null
          file_name: string
          file_type?: string | null
          id?: string
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["price_import_status"]
          report_json?: Json
          storage_url?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type?: string | null
          extraction_method?: string | null
          file_name?: string
          file_type?: string | null
          id?: string
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["price_import_status"]
          report_json?: Json
          storage_url?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      price_import_rows: {
        Row: {
          company_id: string
          confidence_level: Database["public"]["Enums"]["price_confidence"]
          created_at: string
          field_name: string | null
          id: string
          import_file_id: string
          linked_product_id: string | null
          normalized_value: string | null
          original_value: string | null
          page_number: number | null
          review_status: Database["public"]["Enums"]["price_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          row_number: number | null
          sheet_name: string | null
        }
        Insert: {
          company_id?: string
          confidence_level?: Database["public"]["Enums"]["price_confidence"]
          created_at?: string
          field_name?: string | null
          id?: string
          import_file_id: string
          linked_product_id?: string | null
          normalized_value?: string | null
          original_value?: string | null
          page_number?: number | null
          review_status?: Database["public"]["Enums"]["price_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_number?: number | null
          sheet_name?: string | null
        }
        Update: {
          company_id?: string
          confidence_level?: Database["public"]["Enums"]["price_confidence"]
          created_at?: string
          field_name?: string | null
          id?: string
          import_file_id?: string
          linked_product_id?: string | null
          normalized_value?: string | null
          original_value?: string | null
          page_number?: number | null
          review_status?: Database["public"]["Enums"]["price_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_number?: number | null
          sheet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_import_rows_import_file_id_fkey"
            columns: ["import_file_id"]
            isOneToOne: false
            referencedRelation: "price_import_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_import_rows_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "price_products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_product_prices: {
        Row: {
          company_id: string
          confidence_level: Database["public"]["Enums"]["price_confidence"]
          created_at: string
          currency: string
          effective_date: string | null
          expiration_date: string | null
          id: string
          price: number | null
          price_availability: string
          price_list_name: string | null
          price_per_1000_lumens: number | null
          price_per_meter: number | null
          price_per_watt: number | null
          price_unit: string | null
          price_with_tax: number | null
          price_without_tax: number | null
          product_id: string
          region: string | null
          source_file: string | null
          source_page: number | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          confidence_level?: Database["public"]["Enums"]["price_confidence"]
          created_at?: string
          currency?: string
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          price?: number | null
          price_availability?: string
          price_list_name?: string | null
          price_per_1000_lumens?: number | null
          price_per_meter?: number | null
          price_per_watt?: number | null
          price_unit?: string | null
          price_with_tax?: number | null
          price_without_tax?: number | null
          product_id: string
          region?: string | null
          source_file?: string | null
          source_page?: number | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          confidence_level?: Database["public"]["Enums"]["price_confidence"]
          created_at?: string
          currency?: string
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          price?: number | null
          price_availability?: string
          price_list_name?: string | null
          price_per_1000_lumens?: number | null
          price_per_meter?: number | null
          price_per_watt?: number | null
          price_unit?: string | null
          price_with_tax?: number | null
          price_without_tax?: number | null
          product_id?: string
          region?: string | null
          source_file?: string | null
          source_page?: number | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "price_products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_product_specs: {
        Row: {
          attribute_key: string
          attribute_name: string | null
          company_id: string
          confidence_level: Database["public"]["Enums"]["price_confidence"]
          created_at: string
          extraction_method: string | null
          id: string
          manually_reviewed: boolean
          normalized_unit: string | null
          normalized_value: string | null
          original_unit: string | null
          original_value: string | null
          product_id: string
          source_file: string | null
          source_page: number | null
          source_type: string | null
          updated_at: string
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          attribute_key: string
          attribute_name?: string | null
          company_id?: string
          confidence_level?: Database["public"]["Enums"]["price_confidence"]
          created_at?: string
          extraction_method?: string | null
          id?: string
          manually_reviewed?: boolean
          normalized_unit?: string | null
          normalized_value?: string | null
          original_unit?: string | null
          original_value?: string | null
          product_id: string
          source_file?: string | null
          source_page?: number | null
          source_type?: string | null
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          attribute_key?: string
          attribute_name?: string | null
          company_id?: string
          confidence_level?: Database["public"]["Enums"]["price_confidence"]
          created_at?: string
          extraction_method?: string | null
          id?: string
          manually_reviewed?: boolean
          normalized_unit?: string | null
          normalized_value?: string | null
          original_unit?: string | null
          original_value?: string | null
          product_id?: string
          source_file?: string | null
          source_page?: number | null
          source_type?: string | null
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_product_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "price_products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_products: {
        Row: {
          categoria: string
          company_id: string
          competitor_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          descricao: string | null
          familia: string
          id: string
          imagem_url: string | null
          is_base: boolean
          is_deleted: boolean
          marca: string
          nome: string
          referencia: string | null
          sku: string | null
          source_date: string | null
          source_file: string | null
          source_page: number | null
          status: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string
          company_id?: string
          competitor_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          descricao?: string | null
          familia?: string
          id?: string
          imagem_url?: string | null
          is_base?: boolean
          is_deleted?: boolean
          marca: string
          nome: string
          referencia?: string | null
          sku?: string | null
          source_date?: string | null
          source_file?: string | null
          source_page?: number | null
          status?: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          company_id?: string
          competitor_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          descricao?: string | null
          familia?: string
          id?: string
          imagem_url?: string | null
          is_base?: boolean
          is_deleted?: boolean
          marca?: string
          nome?: string
          referencia?: string | null
          sku?: string | null
          source_date?: string | null
          source_file?: string | null
          source_page?: number | null
          status?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_products_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "price_competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      price_shares: {
        Row: {
          base_product_id: string | null
          company_id: string
          company_name: string | null
          created_at: string
          delivery_status: string
          id: string
          included_prices: boolean
          included_products_json: Json
          message: string | null
          pdf_file_url: string | null
          pdf_version: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          share_channel: string
          shared_at: string
          shared_by: string | null
        }
        Insert: {
          base_product_id?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          delivery_status?: string
          id?: string
          included_prices?: boolean
          included_products_json?: Json
          message?: string | null
          pdf_file_url?: string | null
          pdf_version?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          share_channel: string
          shared_at?: string
          shared_by?: string | null
        }
        Update: {
          base_product_id?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          delivery_status?: string
          id?: string
          included_prices?: boolean
          included_products_json?: Json
          message?: string | null
          pdf_file_url?: string | null
          pdf_version?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          share_channel?: string
          shared_at?: string
          shared_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_shares_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "price_products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tables: {
        Row: {
          categoria: Database["public"]["Enums"]["price_table_categoria"]
          categoria_outra: string | null
          company_id: string
          competitor_id: string
          created_at: string
          created_by: string | null
          data_referencia: string
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          observacoes: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["price_table_categoria"]
          categoria_outra?: string | null
          company_id: string
          competitor_id: string
          created_at?: string
          created_by?: string | null
          data_referencia?: string
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          observacoes?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["price_table_categoria"]
          categoria_outra?: string | null
          company_id?: string
          competitor_id?: string
          created_at?: string
          created_by?: string | null
          data_referencia?: string
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          observacoes?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_tables_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "price_competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          canal: string | null
          created_at: string
          descricao: string | null
          id: string
          metadata: Json | null
          prazo_legal_em: string | null
          respondida_em: string | null
          responsavel_id: string | null
          resposta: string | null
          status: string
          tipo: string
          titular_documento: string | null
          titular_email: string
          titular_nome: string
          updated_at: string
        }
        Insert: {
          canal?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          prazo_legal_em?: string | null
          respondida_em?: string | null
          responsavel_id?: string | null
          resposta?: string | null
          status?: string
          tipo: string
          titular_documento?: string | null
          titular_email: string
          titular_nome: string
          updated_at?: string
        }
        Update: {
          canal?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          prazo_legal_em?: string | null
          respondida_em?: string | null
          responsavel_id?: string | null
          resposta?: string | null
          status?: string
          tipo?: string
          titular_documento?: string | null
          titular_email?: string
          titular_nome?: string
          updated_at?: string
        }
        Relationships: []
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
          data_safe: Json
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
          data_safe?: Json
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
          data_safe?: Json
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
          familia_pct: Json
          id: string
          metas_cores: Json
          metas_status: Json
          observacao: string | null
          ordem: number
          razao_social: string
          total_pct: number | null
          total_pct_status: string | null
          upload_id: string
        }
        Insert: {
          acompanhar?: boolean
          categoria?: string | null
          company_id: string
          created_at?: string
          familia_pct?: Json
          id?: string
          metas_cores?: Json
          metas_status?: Json
          observacao?: string | null
          ordem?: number
          razao_social: string
          total_pct?: number | null
          total_pct_status?: string | null
          upload_id: string
        }
        Update: {
          acompanhar?: boolean
          categoria?: string | null
          company_id?: string
          created_at?: string
          familia_pct?: Json
          id?: string
          metas_cores?: Json
          metas_status?: Json
          observacao?: string | null
          ordem?: number
          razao_social?: string
          total_pct?: number | null
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
          atingimento_geral: number | null
          calculation_version: string
          categoria_participacao: Json
          company_id: string
          created_at: string
          escala_percentual: Json
          familia_atingimento_categoria: Json
          familia_participacao_categoria: Json
          familias: string[]
          filename: string | null
          id: string
          observacao: string | null
          origem: string
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
          atingimento_geral?: number | null
          calculation_version?: string
          categoria_participacao?: Json
          company_id: string
          created_at?: string
          escala_percentual?: Json
          familia_atingimento_categoria?: Json
          familia_participacao_categoria?: Json
          familias?: string[]
          filename?: string | null
          id?: string
          observacao?: string | null
          origem?: string
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
          atingimento_geral?: number | null
          calculation_version?: string
          categoria_participacao?: Json
          company_id?: string
          created_at?: string
          escala_percentual?: Json
          familia_atingimento_categoria?: Json
          familia_participacao_categoria?: Json
          familias?: string[]
          filename?: string | null
          id?: string
          observacao?: string | null
          origem?: string
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
      role_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          nav_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          nav_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          nav_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
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
      security_audit_checks: {
        Row: {
          audit_id: string
          categoria: string
          chave: string
          created_at: string
          descricao: string | null
          evidencia: Json | null
          id: string
          peso: number
          recomendacao: string | null
          severidade: string
          status: string
          titulo: string
        }
        Insert: {
          audit_id: string
          categoria: string
          chave: string
          created_at?: string
          descricao?: string | null
          evidencia?: Json | null
          id?: string
          peso?: number
          recomendacao?: string | null
          severidade?: string
          status: string
          titulo: string
        }
        Update: {
          audit_id?: string
          categoria?: string
          chave?: string
          created_at?: string
          descricao?: string | null
          evidencia?: Json | null
          id?: string
          peso?: number
          recomendacao?: string | null
          severidade?: string
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_checks_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "security_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audits: {
        Row: {
          checks_atencao: number | null
          checks_critico: number | null
          checks_nao_verificado: number | null
          checks_ok: number | null
          concluido_em: string | null
          created_at: string
          duracao_ms: number | null
          erro: string | null
          escopo: string
          id: string
          indice_seguranca: number | null
          iniciado_em: string
          iniciado_por: string | null
          resultado: Json | null
          status: string
          total_checks: number | null
        }
        Insert: {
          checks_atencao?: number | null
          checks_critico?: number | null
          checks_nao_verificado?: number | null
          checks_ok?: number | null
          concluido_em?: string | null
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          escopo?: string
          id?: string
          indice_seguranca?: number | null
          iniciado_em?: string
          iniciado_por?: string | null
          resultado?: Json | null
          status?: string
          total_checks?: number | null
        }
        Update: {
          checks_atencao?: number | null
          checks_critico?: number | null
          checks_nao_verificado?: number | null
          checks_ok?: number | null
          concluido_em?: string | null
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          escopo?: string
          id?: string
          indice_seguranca?: number | null
          iniciado_em?: string
          iniciado_por?: string | null
          resultado?: Json | null
          status?: string
          total_checks?: number | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          acao: string | null
          categoria: string | null
          correlation_id: string | null
          id: string
          ip: string | null
          metadata: Json | null
          nivel_risco: string | null
          ocorrido_em: string
          recurso: string | null
          resultado: string | null
          sessao_id: string | null
          tipo: string
          user_agent: string | null
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          acao?: string | null
          categoria?: string | null
          correlation_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          nivel_risco?: string | null
          ocorrido_em?: string
          recurso?: string | null
          resultado?: string | null
          sessao_id?: string | null
          tipo: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string | null
          categoria?: string | null
          correlation_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          nivel_risco?: string | null
          ocorrido_em?: string
          recurso?: string | null
          resultado?: string | null
          sessao_id?: string | null
          tipo?: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      security_incidents: {
        Row: {
          categoria: string | null
          causa: string | null
          comunicacoes: string | null
          contencao: string | null
          created_at: string
          dados_afetados: string | null
          descricao: string | null
          evidencias: Json | null
          gravidade: string
          id: string
          numero: number
          ocorrido_em: string
          organizacoes_afetadas: Json | null
          origem: string | null
          plano_correcao: string | null
          responsavel: string | null
          sistemas_afetados: string | null
          status: string
          timeline: Json
          titulo: string
          updated_at: string
          usuarios_afetados: Json | null
        }
        Insert: {
          categoria?: string | null
          causa?: string | null
          comunicacoes?: string | null
          contencao?: string | null
          created_at?: string
          dados_afetados?: string | null
          descricao?: string | null
          evidencias?: Json | null
          gravidade?: string
          id?: string
          numero?: number
          ocorrido_em?: string
          organizacoes_afetadas?: Json | null
          origem?: string | null
          plano_correcao?: string | null
          responsavel?: string | null
          sistemas_afetados?: string | null
          status?: string
          timeline?: Json
          titulo: string
          updated_at?: string
          usuarios_afetados?: Json | null
        }
        Update: {
          categoria?: string | null
          causa?: string | null
          comunicacoes?: string | null
          contencao?: string | null
          created_at?: string
          dados_afetados?: string | null
          descricao?: string | null
          evidencias?: Json | null
          gravidade?: string
          id?: string
          numero?: number
          ocorrido_em?: string
          organizacoes_afetadas?: Json | null
          origem?: string | null
          plano_correcao?: string | null
          responsavel?: string | null
          sistemas_afetados?: string | null
          status?: string
          timeline?: Json
          titulo?: string
          updated_at?: string
          usuarios_afetados?: Json | null
        }
        Relationships: []
      }
      security_risks: {
        Row: {
          categoria: string
          created_at: string
          dados_afetados: string | null
          data_correcao: string | null
          data_identificacao: string
          descricao: string | null
          evidencias: Json | null
          gravidade: string
          id: string
          impacto: string | null
          origem: string | null
          prazo: string | null
          probabilidade: string | null
          recomendacao: string | null
          responsavel: string | null
          sistema_afetado: string | null
          status: string
          titulo: string
          updated_at: string
          validacao_em: string | null
          validacao_por: string | null
        }
        Insert: {
          categoria: string
          created_at?: string
          dados_afetados?: string | null
          data_correcao?: string | null
          data_identificacao?: string
          descricao?: string | null
          evidencias?: Json | null
          gravidade?: string
          id?: string
          impacto?: string | null
          origem?: string | null
          prazo?: string | null
          probabilidade?: string | null
          recomendacao?: string | null
          responsavel?: string | null
          sistema_afetado?: string | null
          status?: string
          titulo: string
          updated_at?: string
          validacao_em?: string | null
          validacao_por?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          dados_afetados?: string | null
          data_correcao?: string | null
          data_identificacao?: string
          descricao?: string | null
          evidencias?: Json | null
          gravidade?: string
          id?: string
          impacto?: string | null
          origem?: string | null
          prazo?: string | null
          probabilidade?: string | null
          recomendacao?: string | null
          responsavel?: string | null
          sistema_afetado?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          validacao_em?: string | null
          validacao_por?: string | null
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          alert_emails: string[]
          created_at: string
          extensoes_permitidas: string[]
          id: string
          link_expiration_seconds: number
          log_retention_days: number
          max_login_attempts: number
          max_upload_mb: number
          mfa_required_admin: boolean
          min_password_length: number
          retention_days: number
          session_timeout_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_emails?: string[]
          created_at?: string
          extensoes_permitidas?: string[]
          id?: string
          link_expiration_seconds?: number
          log_retention_days?: number
          max_login_attempts?: number
          max_upload_mb?: number
          mfa_required_admin?: boolean
          min_password_length?: number
          retention_days?: number
          session_timeout_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_emails?: string[]
          created_at?: string
          extensoes_permitidas?: string[]
          id?: string
          link_expiration_seconds?: number
          log_retention_days?: number
          max_login_attempts?: number
          max_upload_mb?: number
          mfa_required_admin?: boolean
          min_password_length?: number
          retention_days?: number
          session_timeout_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          acceptance_type: string
          accepted_at: string
          created_at: string
          id: string
          ip_address: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          session_id: string | null
          terms_version_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acceptance_type: string
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          session_id?: string | null
          terms_version_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acceptance_type?: string
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          session_id?: string | null
          terms_version_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_terms_version_id_fkey"
            columns: ["terms_version_id"]
            isOneToOne: false
            referencedRelation: "terms_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_versions: {
        Row: {
          change_summary: string | null
          content: string
          created_at: string
          created_by: string | null
          effective_at: string
          id: string
          is_active: boolean
          published_at: string
          published_by: string | null
          requires_new_acceptance: boolean
          summary_content: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          change_summary?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          published_by?: string | null
          requires_new_acceptance?: boolean
          summary_content?: string | null
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          change_summary?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          published_by?: string | null
          requires_new_acceptance?: boolean
          summary_content?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      transcricoes: {
        Row: {
          created_at: string
          id: string
          texto: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          texto: string
          titulo: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          texto?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      user_nav_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          nav_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          nav_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          nav_key?: string
          updated_at?: string
          user_id?: string
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
      visao_rep_reports: {
        Row: {
          company_id: string | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          creation_mode: string
          data: Json
          id: string
          import_date: string | null
          imported_by: string | null
          region: string | null
          representative_id: string | null
          representative_name: string
          schema_version: string
          source_file_kept: boolean
          source_file_name: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          creation_mode?: string
          data?: Json
          id?: string
          import_date?: string | null
          imported_by?: string | null
          region?: string | null
          representative_id?: string | null
          representative_name: string
          schema_version?: string
          source_file_kept?: boolean
          source_file_name?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          creation_mode?: string
          data?: Json
          id?: string
          import_date?: string | null
          imported_by?: string | null
          region?: string | null
          representative_id?: string | null
          representative_name?: string
          schema_version?: string
          source_file_kept?: boolean
          source_file_name?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visao_rep_reports_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_anonymize_profile: {
        Args: { _justificativa: string; _target_user_id: string }
        Returns: undefined
      }
      admin_conformidade_kpis: { Args: never; Returns: Json }
      admin_list_terms_conformidade: {
        Args: never
        Returns: {
          accepted_at: string
          accepted_version: string
          active_version: string
          email: string
          full_name: string
          last_login_ack_at: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          banned_until: string
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      admin_log_purge_action: {
        Args: {
          _error?: string
          _justificativa: string
          _metadata?: Json
          _request_type: string
          _status?: string
          _target_user_id: string
        }
        Returns: string
      }
      admin_log_session_revocation: {
        Args: { _justificativa: string; _target_user_id: string }
        Returns: string
      }
      admin_mfa_start_enforcement: {
        Args: { _grace_days?: number }
        Returns: Json
      }
      assert_aal2: { Args: never; Returns: boolean }
      compute_bi_shares: { Args: { _rep_id: string }; Returns: Json }
      current_company_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_active_form_by_slug: {
        Args: { _slug: string }
        Returns: {
          id: string
          schema: Json
          title: string
        }[]
      }
      get_admin_mfa_status: {
        Args: never
        Returns: {
          current_aal: string
          days_left: number
          deadline: string
          enforcement_started_at: string
          grace_active: boolean
          has_verified_factor: boolean
          is_admin: boolean
          must_enroll_now: boolean
        }[]
      }
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
      get_my_terms_status: {
        Args: never
        Returns: {
          active_effective_at: string
          active_published_at: string
          active_version: string
          active_version_id: string
          last_accepted_at: string
          last_accepted_version: string
          status: string
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
      is_total_row: { Args: { _name: string }; Returns: boolean }
      kanban_can_access_board: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      kanban_is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      kanban_notify: {
        Args: {
          _board_id: string
          _body: string
          _card_id: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      kanban_workspace_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["kanban_member_role"]
      }
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
      log_auth_failure: {
        Args: { _email: string; _metadata?: Json; _reason?: string }
        Returns: string
      }
      log_mfa_event: {
        Args: {
          _event: Database["public"]["Enums"]["admin_mfa_event"]
          _metadata?: Json
          _target_user?: string
        }
        Returns: string
      }
      log_performance_import: { Args: { _payload: Json }; Returns: string }
      log_security_event: {
        Args: {
          _acao?: string
          _metadata?: Json
          _nivel_risco?: string
          _recurso?: string
          _resultado?: string
          _tipo: string
        }
        Returns: string
      }
      log_sensitive_access: {
        Args: {
          _acao: string
          _metadata?: Json
          _nivel_risco?: string
          _recurso: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      reactivate_last_performance_upload: {
        Args: { _rep_id: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_login_acknowledgement: {
        Args: { _session_id?: string; _user_agent?: string }
        Returns: string
      }
      record_terms_acceptance: {
        Args: { _session_id?: string; _user_agent?: string }
        Returns: string
      }
      reprocessar_fontes_entrevistas: { Args: never; Returns: Json }
      require_admin_aal2: { Args: never; Returns: undefined }
      sec_intrusion_summary: {
        Args: { _hours?: number }
        Returns: {
          bucket: string
          chave: string
          nivel_max: string
          total: number
          ultimo: string
        }[]
      }
      submit_form_response: {
        Args: { _answers: Json; _slug: string; _user_agent?: string }
        Returns: string
      }
      submit_performance_upload: { Args: { _payload: Json }; Returns: Json }
      submit_representative_input: {
        Args: { _data: Json; _token: string }
        Returns: string
      }
    }
    Enums: {
      action_priority: "alta" | "media" | "baixa"
      action_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      admin_mfa_event:
        | "enroll_started"
        | "enroll_completed"
        | "enroll_abandoned"
        | "verify_failed"
        | "challenge_completed"
        | "admin_blocked_no_mfa"
        | "factor_removed_admin"
        | "recovery_executed"
        | "enroll_after_recovery"
        | "deadline_changed"
        | "policy_changed"
        | "admin_op_rejected_aal1"
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
      insight_fonte_status: "pendente" | "processada" | "incluida_na_sintese"
      insight_fonte_tipo:
        | "entrevista"
        | "visita_campo"
        | "voz_loja"
        | "diretoria"
      insight_lente:
        | "marca_preco"
        | "mix"
        | "concorrencia"
        | "argumento"
        | "decisao"
        | "oportunidades"
        | "governanca"
        | "adicionais"
      kanban_activity_type:
        | "card_created"
        | "card_moved"
        | "card_updated"
        | "card_archived"
        | "card_restored"
        | "card_deleted"
        | "comment_added"
        | "comment_edited"
        | "comment_deleted"
        | "checklist_added"
        | "checklist_item_toggled"
        | "member_assigned"
        | "member_removed"
        | "label_added"
        | "label_removed"
        | "attachment_added"
        | "attachment_removed"
        | "due_date_changed"
        | "automation_run"
      kanban_automation_action:
        | "move_to_list"
        | "assign_member"
        | "add_label"
        | "set_due_date"
        | "send_notification"
        | "archive_card"
      kanban_automation_trigger:
        | "card_created"
        | "card_moved_to_list"
        | "due_date_approaching"
        | "card_archived"
        | "checklist_completed"
      kanban_card_priority: "baixa" | "media" | "alta" | "urgente"
      kanban_member_role: "owner" | "admin" | "member" | "observer"
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
      price_confidence:
        | "catalogo"
        | "tabela_precos"
        | "ficha_tecnica"
        | "fornecedor"
        | "excel"
        | "pdf"
        | "ocr"
        | "herdado"
        | "estimado"
        | "manual"
        | "nao_informado"
        | "pendente"
      price_equivalence_level:
        | "direto"
        | "aproximado"
        | "alternativo"
        | "incompativel"
        | "insuficiente"
      price_equivalence_status: "em_analise" | "validado" | "incompativel"
      price_import_status: "pendente" | "processando" | "processado" | "erro"
      price_review_status:
        | "pendente"
        | "aprovado"
        | "corrigido"
        | "rejeitado"
        | "ignorado"
      price_table_categoria: "normal" | "atacado" | "promocional" | "outra"
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
      admin_mfa_event: [
        "enroll_started",
        "enroll_completed",
        "enroll_abandoned",
        "verify_failed",
        "challenge_completed",
        "admin_blocked_no_mfa",
        "factor_removed_admin",
        "recovery_executed",
        "enroll_after_recovery",
        "deadline_changed",
        "policy_changed",
        "admin_op_rejected_aal1",
      ],
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
      insight_fonte_status: ["pendente", "processada", "incluida_na_sintese"],
      insight_fonte_tipo: [
        "entrevista",
        "visita_campo",
        "voz_loja",
        "diretoria",
      ],
      insight_lente: [
        "marca_preco",
        "mix",
        "concorrencia",
        "argumento",
        "decisao",
        "oportunidades",
        "governanca",
        "adicionais",
      ],
      kanban_activity_type: [
        "card_created",
        "card_moved",
        "card_updated",
        "card_archived",
        "card_restored",
        "card_deleted",
        "comment_added",
        "comment_edited",
        "comment_deleted",
        "checklist_added",
        "checklist_item_toggled",
        "member_assigned",
        "member_removed",
        "label_added",
        "label_removed",
        "attachment_added",
        "attachment_removed",
        "due_date_changed",
        "automation_run",
      ],
      kanban_automation_action: [
        "move_to_list",
        "assign_member",
        "add_label",
        "set_due_date",
        "send_notification",
        "archive_card",
      ],
      kanban_automation_trigger: [
        "card_created",
        "card_moved_to_list",
        "due_date_approaching",
        "card_archived",
        "checklist_completed",
      ],
      kanban_card_priority: ["baixa", "media", "alta", "urgente"],
      kanban_member_role: ["owner", "admin", "member", "observer"],
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
      price_confidence: [
        "catalogo",
        "tabela_precos",
        "ficha_tecnica",
        "fornecedor",
        "excel",
        "pdf",
        "ocr",
        "herdado",
        "estimado",
        "manual",
        "nao_informado",
        "pendente",
      ],
      price_equivalence_level: [
        "direto",
        "aproximado",
        "alternativo",
        "incompativel",
        "insuficiente",
      ],
      price_equivalence_status: ["em_analise", "validado", "incompativel"],
      price_import_status: ["pendente", "processando", "processado", "erro"],
      price_review_status: [
        "pendente",
        "aprovado",
        "corrigido",
        "rejeitado",
        "ignorado",
      ],
      price_table_categoria: ["normal", "atacado", "promocional", "outra"],
    },
  },
} as const
