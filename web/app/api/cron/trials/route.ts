import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";
export async function GET(request:Request){if(!cronAuthorized(request))return NextResponse.json({error:"unauthorized"},{status:401});const supabase=createServiceClient();const {data,error}=await supabase.from("profiles").update({trial_status:"ended"}).eq("trial_status","active").lt("trial_ends_at",new Date().toISOString()).select("id");if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ended:data?.length||0});}
