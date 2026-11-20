
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "achievements": {
                  Row: {
                    "code": string,"description": string,"id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"description"?: string,"id"?: string,"title": string
                  }
                  Update: {
                    "code"?: string,"description"?: string,"id"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_suggestions": {
                  Row: {
                    "accepted": boolean | null,"created_at": string,"id": string,"kind": string,"payload": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted"?: boolean | null,"created_at"?: string,"id"?: string,"kind": string,"payload": NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "accepted"?: boolean | null,"created_at"?: string,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"companions": {
                  Row: {
                    "created_at": string,"equipped_cosmetics": NonNullable<Json>,"hatched_at": string | null,"marking_category": Database["public"]['Enums']["category"] | null,"name": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"equipped_cosmetics"?: NonNullable<Json>,"hatched_at"?: string | null,"marking_category"?: Database["public"]['Enums']["category"] | null,"name"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"equipped_cosmetics"?: NonNullable<Json>,"hatched_at"?: string | null,"marking_category"?: Database["public"]['Enums']["category"] | null,"name"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"daily_checkins": {
                  Row: {
                    "available_min": number,"capacity_min": number,"created_at": string,"day": string,"energy": number,"focus": number,"id": string,"mood": Database["public"]['Enums']["mood"] | null,"recommended_min": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "available_min": number,"capacity_min": number,"created_at"?: string,"day": string,"energy": number,"focus": number,"id"?: string,"mood"?: Database["public"]['Enums']["mood"] | null,"recommended_min": number,"user_id"?: string
                  }
                  Update: {
                    "available_min"?: number,"capacity_min"?: number,"created_at"?: string,"day"?: string,"energy"?: number,"focus"?: number,"id"?: string,"mood"?: Database["public"]['Enums']["mood"] | null,"recommended_min"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"daily_plans": {
                  Row: {
                    "checkin_id": string | null,"created_at": string,"day": string,"id": string,"ordered_task_ids": (string)[],"user_id": string,"xp_target": number
                  }
                  ComputedFields: never
                  Insert: {
                    "checkin_id"?: string | null,"created_at"?: string,"day": string,"id"?: string,"ordered_task_ids"?: (string)[],"user_id"?: string,"xp_target": number
                  }
                  Update: {
                    "checkin_id"?: string | null,"created_at"?: string,"day"?: string,"id"?: string,"ordered_task_ids"?: (string)[],"user_id"?: string,"xp_target"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_plans_checkin_id_user_id_fkey"
      columns: ["checkin_id","user_id"]
isOneToOne: false
      referencedRelation: "daily_checkins"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"focus_sessions": {
                  Row: {
                    "ended_at": string | null,"id": string,"outcome": Database["public"]['Enums']["focus_outcome"] | null,"paused_at": string | null,"paused_ms": number,"planned_min": number,"started_at": string,"task_id": string,"user_id": string,"focus_paused_ms": number | null
                  }
                  ComputedFields: "focus_paused_ms"
                  Insert: {
                    "ended_at"?: string | null,"id"?: string,"outcome"?: Database["public"]['Enums']["focus_outcome"] | null,"paused_at"?: string | null,"paused_ms"?: number,"planned_min": number,"started_at"?: string,"task_id": string,"user_id": string
                  }
                  Update: {
                    "ended_at"?: string | null,"id"?: string,"outcome"?: Database["public"]['Enums']["focus_outcome"] | null,"paused_at"?: string | null,"paused_ms"?: number,"planned_min"?: number,"started_at"?: string,"task_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "focus_sessions_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "created_at": string,"done_at": string | null,"id": string,"quest_id": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done_at"?: string | null,"id"?: string,"quest_id": string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"done_at"?: string | null,"id"?: string,"quest_id"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_quest_id_user_id_fkey"
      columns: ["quest_id","user_id"]
isOneToOne: false
      referencedRelation: "quests"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"day_rollover_hour": number,"id": string,"theme": string,"theme_variants": NonNullable<Json>,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_rollover_hour"?: number,"id": string,"theme"?: string,"theme_variants"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"day_rollover_hour"?: number,"id"?: string,"theme"?: string,"theme_variants"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quests": {
                  Row: {
                    "created_at": string,"id": string,"is_boss": boolean,"status": Database["public"]['Enums']["quest_status"],"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_boss"?: boolean,"status"?: Database["public"]['Enums']["quest_status"],"title": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_boss"?: boolean,"status"?: Database["public"]['Enums']["quest_status"],"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reflections": {
                  Row: {
                    "carried_task_ids": (string)[],"created_at": string,"day": string,"id": string,"notes": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "carried_task_ids"?: (string)[],"created_at"?: string,"day": string,"id"?: string,"notes"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "carried_task_ids"?: (string)[],"created_at"?: string,"day"?: string,"id"?: string,"notes"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tasks": {
                  Row: {
                    "carried_from": string | null,"category": Database["public"]['Enums']["category"],"completed_at": string | null,"created_at": string,"difficulty": Database["public"]['Enums']["difficulty"],"est_minutes": number,"id": string,"importance": Database["public"]['Enums']["importance"],"parent_id": string | null,"planned_date": string,"quest_id": string | null,"sort_order": number,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "carried_from"?: string | null,"category"?: Database["public"]['Enums']["category"],"completed_at"?: string | null,"created_at"?: string,"difficulty"?: Database["public"]['Enums']["difficulty"],"est_minutes": number,"id"?: string,"importance"?: Database["public"]['Enums']["importance"],"parent_id"?: string | null,"planned_date": string,"quest_id"?: string | null,"sort_order"?: number,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "carried_from"?: string | null,"category"?: Database["public"]['Enums']["category"],"completed_at"?: string | null,"created_at"?: string,"difficulty"?: Database["public"]['Enums']["difficulty"],"est_minutes"?: number,"id"?: string,"importance"?: Database["public"]['Enums']["importance"],"parent_id"?: string | null,"planned_date"?: string,"quest_id"?: string | null,"sort_order"?: number,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_carried_from_fkey"
      columns: ["carried_from","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "tasks_parent_id_user_id_fkey"
      columns: ["parent_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "tasks_quest_id_user_id_fkey"
      columns: ["quest_id","user_id"]
isOneToOne: false
      referencedRelation: "quests"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"user_achievements": {
                  Row: {
                    "achievement_id": string,"earned_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievement_id": string,"earned_at"?: string,"user_id": string
                  }
                  Update: {
                    "achievement_id"?: string,"earned_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_achievements_achievement_id_fkey"
      columns: ["achievement_id"]
isOneToOne: false
      referencedRelation: "achievements"
      referencedColumns: ["id"]
    }
                  ]
                },"user_unlocks": {
                  Row: {
                    "unlock_code": string,"unlocked_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "unlock_code": string,"unlocked_at"?: string,"user_id": string
                  }
                  Update: {
                    "unlock_code"?: string,"unlocked_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"xp_transactions": {
                  Row: {
                    "amount": number,"created_at": string,"day": string,"id": string,"reason": string,"source_id": string,"source_type": Database["public"]['Enums']["xp_source"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"day": string,"id"?: string,"reason": string,"source_id": string,"source_type": Database["public"]['Enums']["xp_source"],"user_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"day"?: string,"id"?: string,"reason"?: string,"source_id"?: string,"source_type"?: Database["public"]['Enums']["xp_source"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "user_xp": {
                  Row: {
                    "total_xp": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "end_focus_session":
{ Args: { "p_session_id": string }; Returns: {
              "ended_at": string | null,
"id": string,
"outcome": Database["public"]['Enums']["focus_outcome"] | null,
"paused_at": string | null,
"paused_ms": number,
"planned_min": number,
"started_at": string,
"task_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "focus_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"focus_paused_ms":
{ Args: { "s": Omit<Database["public"]['Tables']["focus_sessions"]['Row'], Database["public"]['Tables']["focus_sessions"]['ComputedFields']> }; Returns: number
                           },
"pause_focus_session":
{ Args: { "p_session_id": string }; Returns: {
              "ended_at": string | null,
"id": string,
"outcome": Database["public"]['Enums']["focus_outcome"] | null,
"paused_at": string | null,
"paused_ms": number,
"planned_min": number,
"started_at": string,
"task_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "focus_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"resume_focus_session":
{ Args: { "p_session_id": string }; Returns: {
              "ended_at": string | null,
"id": string,
"outcome": Database["public"]['Enums']["focus_outcome"] | null,
"paused_at": string | null,
"paused_ms": number,
"planned_min": number,
"started_at": string,
"task_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "focus_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"start_focus_session":
{ Args: { "p_planned_min": number,"p_task_id": string }; Returns: {
              "ended_at": string | null,
"id": string,
"outcome": Database["public"]['Enums']["focus_outcome"] | null,
"paused_at": string | null,
"paused_ms": number,
"planned_min": number,
"started_at": string,
"task_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "focus_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"wrap_up_day":
{ Args: { "p_carry": (string)[],"p_day": string,"p_notes": string,"p_to": string,"p_user": string }; Returns: {
              "carried_task_ids": (string)[],
"created_at": string,
"day": string,
"id": string,
"notes": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "reflections"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "category": "deep_work"|"research"|"learning"|"writing"|"admin"|"wellness"|"other","difficulty": "easy"|"medium"|"hard","focus_outcome": "completed"|"ended_early"|"abandoned","importance": "optional"|"normal"|"important"|"critical","mood": "great"|"calm"|"neutral"|"tired"|"anxious"|"low","quest_status": "active"|"done"|"archived","task_status": "planned"|"active"|"done"|"partial"|"carried_over"|"dropped","xp_source": "task"|"focus_session"|"daily_bonus"|"milestone"|"adjustment"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "category": ["deep_work", "research", "learning", "writing", "admin", "wellness", "other"],"difficulty": ["easy", "medium", "hard"],"focus_outcome": ["completed", "ended_early", "abandoned"],"importance": ["optional", "normal", "important", "critical"],"mood": ["great", "calm", "neutral", "tired", "anxious", "low"],"quest_status": ["active", "done", "archived"],"task_status": ["planned", "active", "done", "partial", "carried_over", "dropped"],"xp_source": ["task", "focus_session", "daily_bonus", "milestone", "adjustment"]
          }
        }
} as const
