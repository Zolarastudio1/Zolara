-- Migration: enforce gift card code format and uppercase-normalize final_code

-- Add CHECK constraint enforcing format: ZLR-YYYY-TIER-Bnn-RANDOM6
ALTER TABLE gift_cards
  ADD CONSTRAINT chk_gift_card_code_format
  CHECK ( final_code ~ '^ZLR-[0-9]{4}-(SLV|GLD|PLT|DMD)-B[0-9]{2}-[A-Z0-9]{6}$' );

-- Function to uppercase and trim final_code on insert/update
CREATE OR REPLACE FUNCTION gift_cards_uppercase_final_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.final_code IS NOT NULL THEN
    NEW.final_code := upper(trim(NEW.final_code));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gift_cards_uppercase
BEFORE INSERT OR UPDATE ON gift_cards
FOR EACH ROW
EXECUTE PROCEDURE gift_cards_uppercase_final_code();
