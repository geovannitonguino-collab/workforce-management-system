import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ebwucgarjpuqupwnprfn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVid3VjZ2FyanB1cXVwd25wcmZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDU4NjUsImV4cCI6MjA5MTQyMTg2NX0.5w9CBIb8rGJBAobiNF68jXsjpUA2Se0KKE85rdL4Yn4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
