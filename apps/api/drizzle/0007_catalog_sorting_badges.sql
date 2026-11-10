CREATE TYPE "public"."product_badge" AS ENUM('bestseller', 'low_price');--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "delivery_days" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "badge" "product_badge";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_not_own_parent" CHECK ("categories"."parent_id" <> "categories"."id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_delivery_days_range" CHECK ("products"."delivery_days" BETWEEN 0 AND 60);