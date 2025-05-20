CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" varchar(255) NOT NULL,
	"issue_date" timestamp with time zone NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"items" jsonb,
	"customer_name" varchar(255) NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_details" text,
	"verified_by_tra_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_receipt_number_unique" UNIQUE("receipt_number")
);
