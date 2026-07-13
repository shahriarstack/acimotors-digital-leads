<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Database configuration
$host = 'localhost';
$dbname = 'cvacimot_digital-leads';
$username = 'cvacimot_dbuser';
$password = 'Shahriar@0123';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

$route = isset($_GET['route']) ? $_GET['route'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// Helper to get JSON body
function getJsonBody() {
    $json = file_get_contents('php://input');
    return json_decode($json, true);
}

try {
    // --- 1. Init Data ---
    if ($route === 'init' && $method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM businesses");
        $businessesRes = $stmt->fetchAll();
        
        $stmt = $pdo->query("SELECT * FROM officers");
        $officersRes = $stmt->fetchAll();

        $businesses = [];
        $icons = [];
        foreach ($businessesRes as $b) {
            $businesses[] = $b['name'];
            if (!empty($b['icon'])) {
                $icons[$b['name']] = $b['icon'];
            }
        }

        echo json_encode([
            'businesses' => $businesses,
            'icons' => $icons,
            'officers' => $officersRes
        ]);
        exit;
    }

    // --- 2. Customers CRUD ---
    if ($route === 'customers' && $method === 'GET') {
        $business = isset($_GET['business']) ? $_GET['business'] : null;
        if ($business) {
            $stmt = $pdo->prepare("SELECT * FROM customers WHERE business = ?");
            $stmt->execute([$business]);
            $result = $stmt->fetchAll();
        } else {
            $stmt = $pdo->query("SELECT * FROM customers");
            $result = $stmt->fetchAll();
        }
        echo json_encode($result);
        exit;
    }

    if ($route === 'customers' && $method === 'POST') {
        $cust = getJsonBody();
        $sql = "INSERT INTO customers (
            id, customer_no, name, date, address, model, sale_type, 
            officer_id, officer_name, business, visit_completed, 
            customer_type, field_visit_notes, booking_info, delivery_info, admin_followup
        ) VALUES (
            :id, :customer_no, :name, :date, :address, :model, :sale_type,
            :officer_id, :officer_name, :business, :visit_completed,
            :customer_type, :field_visit_notes, :booking_info, :delivery_info, :admin_followup
        ) ON DUPLICATE KEY UPDATE 
            customer_no = VALUES(customer_no),
            name = VALUES(name),
            date = VALUES(date),
            address = VALUES(address),
            model = VALUES(model),
            sale_type = VALUES(sale_type),
            officer_id = VALUES(officer_id),
            officer_name = VALUES(officer_name),
            business = VALUES(business),
            visit_completed = VALUES(visit_completed),
            customer_type = VALUES(customer_type),
            field_visit_notes = VALUES(field_visit_notes),
            booking_info = VALUES(booking_info),
            delivery_info = VALUES(delivery_info),
            admin_followup = VALUES(admin_followup)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id' => $cust['id'],
            ':customer_no' => $cust['customer_no'] ?? null,
            ':name' => $cust['name'],
            ':date' => $cust['date'] ?? null,
            ':address' => $cust['address'] ?? null,
            ':model' => $cust['model'] ?? null,
            ':sale_type' => $cust['sale_type'] ?? null,
            ':officer_id' => $cust['officer_id'] ?? null,
            ':officer_name' => $cust['officer_name'] ?? null,
            ':business' => $cust['business'] ?? null,
            ':visit_completed' => $cust['visit_completed'] ?? 'No',
            ':customer_type' => $cust['customer_type'] ?? null,
            ':field_visit_notes' => $cust['field_visit_notes'] ?? null,
            ':booking_info' => $cust['booking_info'] ?? null,
            ':delivery_info' => $cust['delivery_info'] ?? null,
            ':admin_followup' => $cust['admin_followup'] ?? null
        ]);
        echo json_encode(['success' => true]);
        exit;
    }

    if (preg_match('/^customers\/(.+)$/', $route, $matches) && $method === 'DELETE') {
        $id = $matches[1];
        $stmt = $pdo->prepare("DELETE FROM customers WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        exit;
    }

    // --- 3. Officers CRUD ---
    if ($route === 'officers' && $method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM officers");
        echo json_encode($stmt->fetchAll());
        exit;
    }

    if ($route === 'officers' && $method === 'POST') {
        $o = getJsonBody();
        $sql = "INSERT INTO officers (id, full_name, territory, password, role, business)
                VALUES (:id, :full_name, :territory, :password, :role, :business)
                ON DUPLICATE KEY UPDATE 
                full_name = VALUES(full_name),
                territory = VALUES(territory),
                password = VALUES(password),
                role = VALUES(role),
                business = VALUES(business)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id' => $o['id'],
            ':full_name' => $o['full_name'],
            ':territory' => $o['territory'] ?? null,
            ':password' => $o['password'],
            ':role' => $o['role'] ?? 'officer',
            ':business' => $o['business'] ?? null
        ]);
        echo json_encode(['success' => true]);
        exit;
    }

    if (preg_match('/^officers\/(.+)$/', $route, $matches) && $method === 'DELETE') {
        $id = $matches[1];
        $stmt = $pdo->prepare("DELETE FROM officers WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        exit;
    }

    // --- 4. Businesses CRUD ---
    if ($route === 'businesses' && $method === 'POST') {
        $b = getJsonBody();
        $sql = "INSERT INTO businesses (name, icon) VALUES (:name, :icon)
                ON DUPLICATE KEY UPDATE icon = VALUES(icon)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':name' => $b['name'],
            ':icon' => $b['icon'] ?? null
        ]);
        echo json_encode(['success' => true]);
        exit;
    }

    if (preg_match('/^businesses\/(.+)$/', $route, $matches) && $method === 'DELETE') {
        $name = urldecode($matches[1]);
        $stmt = $pdo->prepare("DELETE FROM businesses WHERE name = ?");
        $stmt->execute([$name]);
        echo json_encode(['success' => true]);
        exit;
    }

    // Default 404
    http_response_code(404);
    echo json_encode(['error' => 'Route not found']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
