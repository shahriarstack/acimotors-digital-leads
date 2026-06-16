import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { cors } from 'hono/cors'; // Import CORS
import { neon } from '@neondatabase/serverless';

const app = new Hono().basePath('/api');

// --- 1. ENABLE CORS (CRITICAL FOR MOBILE/REMOTE ACCESS) ---
app.use('/*', cors({
  origin: '*', // Allow all origins for simplicity (or set to your specific domain)
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// --- 2. Init Data ---
app.get('/init', async (c) => {
    try {
        if (!c.env.DATABASE_URL) return c.json({ error: 'Missing DATABASE_URL' }, 500);
        
        const sql = neon(c.env.DATABASE_URL);
        const businessesRes = await sql`SELECT * FROM businesses`;
        const officersRes = await sql`SELECT * FROM officers`;

        const businesses = businessesRes.map(b => b.name);
        const icons = {};
        businessesRes.forEach(b => {
            if (b.icon) icons[b.name] = b.icon;
        });

        return c.json({
            businesses,
            icons,
            officers: officersRes
        });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// --- 3. Customers CRUD ---
app.get('/customers', async (c) => {
    try {
        const sql = neon(c.env.DATABASE_URL);
        const business = c.req.query('business');
        
        let result;
        if (business) {
            result = await sql`SELECT * FROM customers WHERE business = ${business}`;
        } else {
            result = await sql`SELECT * FROM customers`;
        }
        return c.json(result);
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/customers', async (c) => {
    try {
        const sql = neon(c.env.DATABASE_URL);
        const cust = await c.req.json();
        
        await sql`
            INSERT INTO customers (
                id, customer_no, name, date, address, model, sale_type, 
                officer_id, officer_name, business, visit_completed, 
                customer_type, field_visit_notes, booking_info, delivery_info
            ) VALUES (
                ${cust.id}, ${cust.customer_no}, ${cust.name}, ${cust.date}, ${cust.address}, ${cust.model}, ${cust.sale_type},
                ${cust.officer_id}, ${cust.officer_name}, ${cust.business}, ${cust.visit_completed || 'No'},
                ${cust.customer_type}, ${cust.field_visit_notes}, ${cust.booking_info}, ${cust.delivery_info}
            )
            ON CONFLICT (id) DO UPDATE SET
                customer_no = EXCLUDED.customer_no,
                name = EXCLUDED.name,
                date = EXCLUDED.date,
                address = EXCLUDED.address,
                model = EXCLUDED.model,
                sale_type = EXCLUDED.sale_type,
                officer_id = EXCLUDED.officer_id,
                officer_name = EXCLUDED.officer_name,
                business = EXCLUDED.business,
                visit_completed = EXCLUDED.visit_completed,
                customer_type = EXCLUDED.customer_type,
                field_visit_notes = EXCLUDED.field_visit_notes,
                booking_info = EXCLUDED.booking_info,
                delivery_info = EXCLUDED.delivery_info;
        `;
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.delete('/customers/:id', async (c) => {
    try {
        const sql = neon(c.env.DATABASE_URL);
        const id = c.req.param('id');
        await sql`DELETE FROM customers WHERE id = ${id}`;
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// --- 4. Officers CRUD ---
app.get('/officers', async (c) => {
    try {
        const sql = neon(c.env.DATABASE_URL);
        const result = await sql`SELECT * FROM officers`;
        return c.json(result);
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/officers', async (c) => {
    try {
        const sql = neon(c.env.DATABASE_URL);
        const o = await c.req.json();
        
        await sql`
            INSERT INTO officers (id, full_name, territory, password, role, business)
            VALUES (${o.id}, ${o.full_name}, ${o.territory}, ${o.password}, ${o.role}, ${o.business})
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                territory = EXCLUDED.territory,
                password = EXCLUDED.password,
                role = EXCLUDED.role,
                business = EXCLUDED.business;
        `;
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.delete('/officers/:id', async (c) => {
    try {
        const sql = neon(c.env.DATABASE_URL);
        const id = c.req.param('id');
        await sql`DELETE FROM officers WHERE id = ${id}`;
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// --- 5. Businesses CRUD ---
app.post('/businesses', async (c) => {
    try {
        const sql = neon(c.env.DATABASE_URL);
        const { name, icon } = await c.req.json();
        await sql`INSERT INTO businesses (name, icon) VALUES (${name}, ${icon}) ON CONFLICT (name) DO UPDATE SET icon = ${icon}`;
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

app.delete('/businesses/:name', async (c) => {
    try {
        const sql = neon(c.env.DATABASE_URL);
        const name = c.req.param('name');
        await sql`DELETE FROM businesses WHERE name = ${name}`;
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

export const onRequest = handle(app);
