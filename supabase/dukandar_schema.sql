-- ==============================================================================
-- Schema for Dukandar (Shopkeeper) Rewards System
-- Completely isolated from Karigars to guarantee 100% zero collision
-- ==============================================================================

-- 1. Dukandars Table
CREATE TABLE IF NOT EXISTS public.dukandars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    total_points INTEGER NOT NULL DEFAULT 0,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Dukandar Orders Table (Cement Bags only; 1 bag = 1 point)
CREATE TABLE IF NOT EXISTS public.dukandar_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dukandar_id UUID NOT NULL REFERENCES public.dukandars(id) ON DELETE CASCADE,
    bags_ordered INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    order_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    entered_by TEXT NOT NULL,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    whatsapp_status TEXT DEFAULT 'pending',
    whatsapp_message_id TEXT
);

-- 3. Dukandar Points Ledger Table
CREATE TABLE IF NOT EXISTS public.dukandar_points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dukandar_id UUID NOT NULL REFERENCES public.dukandars(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.dukandar_orders(id) ON DELETE RESTRICT,
    points_change INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Function & Trigger to auto-update total_points in dukandars
CREATE OR REPLACE FUNCTION update_dukandar_total_points()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.dukandars
    SET total_points = total_points + NEW.points_change
    WHERE id = NEW.dukandar_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dukandar_total_points ON public.dukandar_points_ledger;
CREATE TRIGGER trigger_update_dukandar_total_points
AFTER INSERT ON public.dukandar_points_ledger
FOR EACH ROW
EXECUTE FUNCTION update_dukandar_total_points();

-- 5. Set up Row Level Security (RLS)
ALTER TABLE public.dukandars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dukandar_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dukandar_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to dukandars" ON public.dukandars FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to dukandars" ON public.dukandars FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to dukandars" ON public.dukandars FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access to dukandars" ON public.dukandars FOR DELETE USING (true);

CREATE POLICY "Allow anonymous read access to dukandar_orders" ON public.dukandar_orders FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to dukandar_orders" ON public.dukandar_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to dukandar_orders" ON public.dukandar_orders FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous read access to dukandar_points_ledger" ON public.dukandar_points_ledger FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to dukandar_points_ledger" ON public.dukandar_points_ledger FOR INSERT WITH CHECK (true);

-- 6. Enable Realtime for dukandar_orders and dukandars
ALTER PUBLICATION supabase_realtime ADD TABLE public.dukandar_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dukandars;
