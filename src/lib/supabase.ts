import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xrxghauhfmdimhhmxpgh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyeGdoYXVoZm1kaW1oaG14cGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MjQzMTEsImV4cCI6MjA3NjMwMDMxMX0.XxK3lhpsgk4LfHs5JIYzoTQNCrKn5IHTK-A6auGaTKA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Video {
  id: string
  title: string
  file_path: string
  access_password: string | null
  is_enabled: boolean
  created_at: string
  user_id: string
  is_chunked?: boolean
  chunk_count?: number
  chunk_paths?: string[]
  file_size?: number
  downloadable?: boolean
}
