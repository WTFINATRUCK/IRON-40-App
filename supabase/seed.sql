-- Demo catalog for the preview store. License fields are placeholders: set real values in Ops → Settings.
-- Demo user accounts are NOT created here (no credentials in git). See docs/SETUP.md.

insert into public.tenants (slug, name, license_number, license_state, timezone)
values ('iron40', 'IRON 40', 'PENDING-LICENSE', 'NY', 'America/New_York')
on conflict (slug) do nothing;

with t as (select id from public.tenants where slug = 'iron40')
insert into public.locations (tenant_id, name, address, lat, lng, radius_km)
select t.id, 'Hub 1', 'Set the real hub address in Ops → Locations', 40.7505, -73.9934, 25 from t
where not exists (select 1 from public.locations l, t where l.tenant_id = t.id);

with t as (select id from public.tenants where slug = 'iron40')
insert into public.products (tenant_id, category, subcategory, name, description, strain, thc_pct, weight_g, price_cents, sort)
select t.id, v.category::public.product_category, v.subcategory, v.name, v.description, v.strain, v.thc_pct, v.weight_g, v.price_cents, v.sort
from t, (values
  ('flower', 'Eighth',  'Forge OG',          'Dense, gassy nugs. Heavy body, slow evening.',               'indica', 24.1, 3.5,  4500, 10),
  ('flower', 'Eighth',  'Blue Anvil',        'Blueberry nose, balanced head and body.',                    'hybrid', 22.8, 3.5,  4200, 20),
  ('flower', 'Eighth',  'Tin Lizzie Haze',   'Bright citrus haze for daytime.',                            'sativa', 21.5, 3.5,  4000, 30),
  ('flower', 'Quarter', 'Cast Iron Kush',    'Earthy, hash-forward classic.',                              'indica', 26.3, 7.0,  8000, 40),
  ('flower', 'Half',    'Slag Runtz',        'Candy-sweet, smooth smoke. Best value.',                     'hybrid', 23.0, 14.0, 14000, 50),
  ('concentrate', 'Live resin', 'Forge OG Live Resin', 'Flash-frozen at harvest. Full terpene profile.',   'indica', 78.0, 1.0,  5500, 10),
  ('concentrate', 'Shatter',    'Blue Anvil Shatter',  'Glassy, stable, easy to dose.',                    'hybrid', 81.0, 1.0,  4000, 20),
  ('concentrate', 'Rosin',      'Cold-Press Rosin',    'Solventless, pressed from ice-water hash.',        'hybrid', 72.0, 1.0,  7000, 30),
  ('concentrate', 'Badder',     'Tin Lizzie Badder',   'Whipped texture, citrus terps.',                   'sativa', 76.0, 1.0,  5000, 40)
) as v(category, subcategory, name, description, strain, thc_pct, weight_g, price_cents, sort)
where not exists (select 1 from public.products p where p.tenant_id = t.id);

with t as (select id from public.tenants where slug = 'iron40')
insert into public.products (tenant_id, category, subcategory, name, description, price_cents, sort)
select t.id, 'gear', v.subcategory, v.name, v.description, v.price_cents, v.sort
from t, (values
  ('Ash tray',     'Cast Iron Ash Tray',        'Heavy enough that it never tips. Matte black.', 2800, 10),
  ('Rolling tray', 'Steel Rolling Tray, Large', '11 x 7 in, rolled edges, magnetic lid.',        3200, 20),
  ('Rolling tray', 'Pocket Rolling Tray',       'Fits a back pocket. Raised rim.',               1800, 30),
  ('Grinder',      '4-Piece Grinder, 63 mm',    'Aircraft aluminum, kief screen, sharp teeth.',  3800, 40),
  ('Lighter',      'Torch Lighter',             'Windproof jet flame, refillable.',              2200, 50),
  ('Lighter',      'Classic Lighter 3-Pack',    'Three everyday lighters.',                       900, 60)
) as v(subcategory, name, description, price_cents, sort)
where not exists (select 1 from public.products p where p.tenant_id = t.id and p.category = 'gear');

insert into public.location_inventory (location_id, product_id, qty)
select l.id, p.id, case when p.category = 'gear' then 40 else 60 end
from public.locations l join public.products p on p.tenant_id = l.tenant_id
join public.tenants t on t.id = l.tenant_id and t.slug = 'iron40'
on conflict do nothing;
