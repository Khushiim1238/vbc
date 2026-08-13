-- Schema for Karigar Rewards System

-- 1. Karigars Table
CREATE TABLE public.karigars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    total_points INTEGER NOT NULL DEFAULT 0,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Orders Table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    karigar_id UUID NOT NULL REFERENCES public.karigars(id) ON DELETE CASCADE,
    bags_ordered INTEGER NOT NULL DEFAULT 0,
    sariya_ordered INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    order_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    entered_by TEXT NOT NULL,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    whatsapp_status TEXT DEFAULT 'pending',
    whatsapp_message_id TEXT,
    coupon_number INTEGER
);

-- Sequence for coupon numbers (only used upon approval)
CREATE SEQUENCE IF NOT EXISTS public.coupon_seq START 1;

-- RPC function to safely get next coupon number
CREATE OR REPLACE FUNCTION get_next_coupon()
RETURNS integer AS $$
BEGIN
    RETURN nextval('coupon_seq');
END;
$$ LANGUAGE plpgsql;

-- 3. Points Ledger Table
CREATE TABLE public.points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    karigar_id UUID NOT NULL REFERENCES public.karigars(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE RESTRICT,
    points_change INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Function & Trigger to auto-update total_points in karigars
CREATE OR REPLACE FUNCTION update_karigar_total_points()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the total_points in karigars table atomically
    UPDATE public.karigars
    SET total_points = total_points + NEW.points_change
    WHERE id = NEW.karigar_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_karigar_total_points
AFTER INSERT ON public.points_ledger
FOR EACH ROW
EXECUTE FUNCTION update_karigar_total_points();

-- Set up Row Level Security (RLS)
-- For this Phase 1, we will allow all access for simplicity (assuming internal use), 
-- but in production, we should lock this down.
ALTER TABLE public.karigars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to karigars" ON public.karigars FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to karigars" ON public.karigars FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to karigars" ON public.karigars FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous read access to orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to orders" ON public.orders FOR UPDATE USING (true);

-- Enable Realtime for orders and karigars
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.karigars;

CREATE POLICY "Allow anonymous read access to points_ledger" ON public.points_ledger FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to points_ledger" ON public.points_ledger FOR INSERT WITH CHECK (true);
