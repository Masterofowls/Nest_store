CREATE TYPE "public"."attribute_type" AS ENUM('text', 'number', 'boolean');--> statement-breakpoint
CREATE TABLE "attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "attribute_type" NOT NULL,
	"unit" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "attributes_slug_unique" UNIQUE("slug"),
	CONSTRAINT "attributes_slug_format" CHECK ("attributes"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "product_attribute_values" (
	"product_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value_text" text,
	"value_number" numeric(12, 3),
	"value_boolean" boolean,
	CONSTRAINT "product_attribute_values_product_id_attribute_id_pk" PRIMARY KEY("product_id","attribute_id"),
	CONSTRAINT "product_attribute_values_one_value" CHECK (num_nonnulls("product_attribute_values"."value_text", "product_attribute_values"."value_number", "product_attribute_values"."value_boolean") = 1)
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "variant_group_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "slug" text GENERATED ALWAYS AS (coalesce(nullif(trim(both '-' from regexp_replace(translate(replace(replace(replace(replace(replace(replace(replace(replace(lower("name"), 'ж', 'zh'), 'ч', 'ch'), 'ш', 'sh'), 'щ', 'sch'), 'ю', 'yu'), 'я', 'ya'), 'ё', 'yo'), 'х', 'kh'), 'абвгдезийклмнопрстуфцыэъь', 'abvgdezijklmnoprstufcye'), '[^a-z0-9]+', '-', 'g')), ''), 'item') || '-' || right("id"::text, 8)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attributes_category_id_idx" ON "attributes" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_attribute_values_attribute_idx" ON "product_attribute_values" USING btree ("attribute_id","value_text");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_brand_id_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_variant_group_id_idx" ON "products" USING btree ("variant_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_unique" ON "products" USING btree ("slug");