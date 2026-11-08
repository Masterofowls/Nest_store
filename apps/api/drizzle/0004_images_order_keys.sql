CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_path_unique" UNIQUE("path"),
	CONSTRAINT "product_images_status_check" CHECK ("product_images"."status" IN ('pending', 'ready'))
);
--> statement-breakpoint
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "storage_cleanup" (
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_cleanup_bucket_path_pk" PRIMARY KEY("bucket","path")
);
--> statement-breakpoint
ALTER TABLE "storage_cleanup" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_key" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_user_checkout_key_unique" ON "orders" USING btree ("user_id","checkout_key");
--> statement-breakpoint
CREATE FUNCTION public.queue_product_image_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.storage_cleanup (bucket, path)
  VALUES (OLD.bucket, OLD.path)
  ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.queue_product_image_cleanup() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER product_images_cleanup
AFTER DELETE ON public.product_images
FOR EACH ROW EXECUTE FUNCTION public.queue_product_image_cleanup();