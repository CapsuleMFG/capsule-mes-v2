CREATE TABLE IF NOT EXISTS "product_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_lines_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"product_line_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stations" ADD CONSTRAINT "stations_product_line_id_product_lines_id_fk" FOREIGN KEY ("product_line_id") REFERENCES "public"."product_lines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
