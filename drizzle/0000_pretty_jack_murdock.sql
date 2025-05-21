CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"verification_code" text NOT NULL,
	"receipt_time" text NOT NULL,
	"receipt_data" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "receipts_verification_code_unique" UNIQUE("verification_code")
);
