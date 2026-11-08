ALTER TABLE "storage_cleanup" ADD COLUMN "not_before" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE public.storage_cleanup
SET not_before = created_at
WHERE created_at > now();