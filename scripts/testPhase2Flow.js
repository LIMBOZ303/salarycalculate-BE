/**
 * Phase 2 automated flow tests
 * Prerequisites: MongoDB running, server on http://localhost:5000, admin seeded
 *
 * Run: npm run seed && npm run test:phase2
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const TS = Date.now();
const createRandomEmail = (prefix) => `${prefix}_${TS}@gmail.com`;

let failed = 0;

const pickId = (obj) => {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  return obj._id || obj.id || null;
};

const sameId = (a, b) => String(a) === String(b);

const logPass = (message) => {
  console.log(`  PASS: ${message}`);
};

const logFail = (message, response) => {
  failed += 1;
  console.log(`  FAIL: ${message}`);
  if (response) {
    console.log(`        status: ${response.status}`);
    console.log(`        body: ${JSON.stringify(response.body, null, 2)}`);
  }
};

const assert = (condition, message, response) => {
  if (condition) {
    logPass(message);
    return true;
  }
  logFail(message, response);
  return false;
};

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, body: json, ok: true };
  } catch (error) {
    const hint =
      error.cause?.code === 'ECONNREFUSED'
        ? `Server not reachable at ${BASE_URL}. Run: npm run dev`
        : error.message;
    return {
      status: 0,
      body: { success: false, message: hint, error: error.message },
      ok: false,
    };
  }
}

async function getTokenFromLogin(email, password) {
  const res = await request('POST', '/api/auth/login', { email, password });
  return res.body?.data?.token || null;
}

async function runTest(name, fn) {
  console.log(`\n[${name}]`);
  try {
    await fn();
  } catch (error) {
    logFail(`${name} threw error: ${error.message}`);
    console.error(error);
  }
}

async function main() {
  if (typeof fetch === 'undefined') {
    console.error(
      'Node.js của bạn không có fetch. Dùng Node 18+ hoặc: npm install node-fetch'
    );
    process.exit(1);
  }

  console.log('=== Phase 2 Flow Tests ===');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Timestamp: ${TS}`);

  let ADMIN_TOKEN = null;
  let BRANCH_ID = null;
  let EMPLOYEE_USER_ID = null;
  let EMPLOYEE_EMAIL = null;
  let EMPLOYEE_TOKEN = null;
  let OWNER_USER_ID = null;
  let OWNER_TOKEN = null;
  let MANAGER_USER_ID = null;
  let MANAGER_TOKEN = null;

  // 1. GET /
  await runTest('1. GET / health', async () => {
    const res = await request('GET', '/');
    assert(res.ok !== false, 'server should be reachable', res);
    assert(res.status === 200, 'status should be 200', res);
    assert(res.body?.success === true, 'success should be true', res);
  });

  // 2. Admin login
  await runTest('2. Admin login', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@gmail.com',
      password: '123456',
    });
    assert(res.status === 200, 'status should be 200', res);
    assert(res.body?.success === true, 'success should be true', res);
    assert(!!res.body?.data?.token, 'data.token should exist', res);
    assert(
      res.body?.data?.user?.role === 'admin',
      'user.role should be admin',
      res
    );
    assert(
      res.body?.data?.user?.status === 'active',
      'user.status should be active',
      res
    );
    ADMIN_TOKEN = res.body.data.token;
  });

  if (!ADMIN_TOKEN) {
    console.error('\nCannot continue without ADMIN_TOKEN. Run: npm run seed');
    process.exit(1);
  }

  // 3. Admin create branch
  await runTest('3. Admin create branch', async () => {
    const res = await request(
      'POST',
      '/api/branches',
      {
        name: `Test Branch ${TS}`,
        address: 'Test Address',
        phone: '0900000001',
        latitude: 10.762622,
        longitude: 106.660172,
        allowedRadiusMeters: 100,
      },
      ADMIN_TOKEN
    );
    assert([200, 201].includes(res.status), 'status should be 200 or 201', res);
    assert(res.body?.success === true, 'success should be true', res);
    const branch = res.body?.data?.branch || res.body?.data;
    BRANCH_ID = pickId(branch);
    assert(!!BRANCH_ID, 'branch id should exist', res);
  });

  if (!BRANCH_ID) {
    console.error('\nCannot continue without BRANCH_ID');
    process.exit(1);
  }

  // 4. Register employee
  EMPLOYEE_EMAIL = createRandomEmail('employee_test');
  await runTest('4. Register employee (pending)', async () => {
    const res = await request('POST', '/api/auth/register', {
      fullName: `Test Employee ${TS}`,
      phone: '0901234567',
      email: EMPLOYEE_EMAIL,
      password: '123456',
    });
    assert([200, 201].includes(res.status), 'status should be 200 or 201', res);
    assert(res.body?.success === true, 'success should be true', res);
    const user = res.body?.data?.user || res.body?.data;
    assert(user?.role === 'employee', 'role should be employee', res);
    assert(user?.status === 'pending', 'status should be pending', res);
    EMPLOYEE_USER_ID = pickId(user);
    assert(!!EMPLOYEE_USER_ID, 'employee user id should exist', res);
  });

  // 5. Pending employee cannot login
  await runTest('5. Pending employee login blocked', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: EMPLOYEE_EMAIL,
      password: '123456',
    });
    assert(res.status === 403, 'status should be 403', res);
    assert(res.body?.success === false, 'success should be false', res);
    const msg = (res.body?.message || '').toLowerCase();
    assert(
      msg.includes('chờ') || msg.includes('duyệt') || msg.includes('active'),
      'message should mention pending/approval',
      res
    );
  });

  // 6. Admin view pending employees
  await runTest('6. Admin view pending employees', async () => {
    const res = await request(
      'GET',
      '/api/admin/employees/pending',
      null,
      ADMIN_TOKEN
    );
    assert(res.status === 200, 'status should be 200', res);
    assert(res.body?.success === true, 'success should be true', res);
    const users = res.body?.data?.users || res.body?.data || [];
    const found = Array.isArray(users)
      ? users.some(
          (u) =>
            sameId(pickId(u), EMPLOYEE_USER_ID) ||
            u.email === EMPLOYEE_EMAIL
        )
      : false;
    assert(found, 'pending list should contain registered employee', res);
  });

  // 7. Admin approve employee
  await runTest('7. Admin approve employee', async () => {
    const res = await request(
      'POST',
      `/api/admin/employees/${EMPLOYEE_USER_ID}/approve`,
      {
        branchId: BRANCH_ID,
        position: 'Nhân viên pha chế',
        hourlyRate: 27000,
        shiftId: null,
        startDate: '2026-01-01',
        note: 'Nhân viên test tự động',
      },
      ADMIN_TOKEN
    );
    assert([200, 201].includes(res.status), 'status should be 200 or 201', res);
    assert(res.body?.success === true, 'success should be true', res);
    const user = res.body?.data?.user;
    const employee = res.body?.data?.employee;
    const userStatus = user?.status;
    const empStatus = employee?.status;
    assert(
      userStatus === 'active' || empStatus === 'active',
      'user or employee status should be active',
      res
    );
    const empBranchId = pickId(employee?.branchId) || employee?.branchId;
    assert(
      sameId(empBranchId, BRANCH_ID),
      'employee.branchId should match BRANCH_ID',
      res
    );
    assert(employee?.hourlyRate === 27000, 'hourlyRate should be 27000', res);
  });

  // 8. Employee login after approval
  await runTest('8. Employee login after approval', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: EMPLOYEE_EMAIL,
      password: '123456',
    });
    assert(res.status === 200, 'status should be 200', res);
    assert(res.body?.success === true, 'success should be true', res);
    assert(!!res.body?.data?.token, 'token should exist', res);
    assert(
      res.body?.data?.user?.role === 'employee',
      'role should be employee',
      res
    );
    assert(
      res.body?.data?.user?.status === 'active',
      'status should be active',
      res
    );
    EMPLOYEE_TOKEN = res.body.data.token;
  });

  // 9. Employee GET /me
  await runTest('9. Employee GET /api/employees/me', async () => {
    const res = await request('GET', '/api/employees/me', null, EMPLOYEE_TOKEN);
    assert(res.status === 200, 'status should be 200', res);
    assert(res.body?.success === true, 'success should be true', res);
    const employee = res.body?.data?.employee || res.body?.data;
    const email = employee?.email;
    const userId = pickId(employee?.userId) || employee?.userId;
    assert(
      email === EMPLOYEE_EMAIL || sameId(userId, EMPLOYEE_USER_ID),
      'email or userId should match employee',
      res
    );
    assert(
      employee?.branchId != null,
      'branchId should exist',
      res
    );
    assert(!!employee?.position, 'position should exist', res);
    assert(
      employee?.hourlyRate != null,
      'hourlyRate should exist',
      res
    );
  });

  // 10. Employee cannot list employees
  await runTest('10. Employee cannot GET /api/employees', async () => {
    const res = await request('GET', '/api/employees', null, EMPLOYEE_TOKEN);
    assert(res.status === 403, 'status should be 403', res);
    assert(res.body?.success === false, 'success should be false', res);
  });

  // 11. Employee cannot list branches
  await runTest('11. Employee cannot GET /api/branches', async () => {
    const res = await request('GET', '/api/branches', null, EMPLOYEE_TOKEN);
    assert(res.status === 403, 'status should be 403', res);
    assert(res.body?.success === false, 'success should be false', res);
  });

  // 12. Owner read-only
  const ownerEmail = createRandomEmail('owner_test');
  await runTest('12. Owner read-only on branches', async () => {
    const reg = await request('POST', '/api/auth/register', {
      fullName: `Test Owner ${TS}`,
      phone: '0909999999',
      email: ownerEmail,
      password: '123456',
    });
    const ownerUser = reg.body?.data?.user || reg.body?.data;
    OWNER_USER_ID = pickId(ownerUser);
    assert(!!OWNER_USER_ID, 'owner user id should exist', reg);

    const roleRes = await request(
      'PATCH',
      `/api/admin/users/${OWNER_USER_ID}/role`,
      { role: 'owner' },
      ADMIN_TOKEN
    );
    assert(roleRes.status === 200, 'admin set owner role should succeed', roleRes);

    const statusRes = await request(
      'PATCH',
      `/api/admin/users/${OWNER_USER_ID}/status`,
      { status: 'active', reason: 'Activate owner test account' },
      ADMIN_TOKEN
    );
    assert(
      statusRes.status === 200,
      'admin activate owner should succeed',
      statusRes
    );

    OWNER_TOKEN = await getTokenFromLogin(ownerEmail, '123456');
    assert(!!OWNER_TOKEN, 'owner login should succeed', {
      status: 200,
      body: { token: OWNER_TOKEN },
    });

    const loginCheck = await request('POST', '/api/auth/login', {
      email: ownerEmail,
      password: '123456',
    });
    assert(
      loginCheck.body?.data?.user?.role === 'owner',
      'owner role should be owner',
      loginCheck
    );
    assert(
      loginCheck.body?.data?.user?.status === 'active',
      'owner status should be active',
      loginCheck
    );

    const getBranches = await request('GET', '/api/branches', null, OWNER_TOKEN);
    assert(getBranches.status === 200, 'owner GET branches should be 200', getBranches);
    assert(
      getBranches.body?.success === true,
      'owner GET branches success true',
      getBranches
    );

    const postBranch = await request(
      'POST',
      '/api/branches',
      {
        name: `Owner Forbidden Branch ${TS}`,
        address: 'Forbidden',
        latitude: 10,
        longitude: 106,
      },
      OWNER_TOKEN
    );
    assert(postBranch.status === 403, 'owner POST branch should be 403', postBranch);
    assert(
      postBranch.body?.success === false,
      'owner POST branch success false',
      postBranch
    );
  });

  // 13. Branch manager scope
  const managerEmail = createRandomEmail('manager_test');
  await runTest('13. Branch manager scope', async () => {
    const reg = await request('POST', '/api/auth/register', {
      fullName: `Test Branch Manager ${TS}`,
      phone: '0908888888',
      email: managerEmail,
      password: '123456',
    });
    const managerUser = reg.body?.data?.user || reg.body?.data;
    MANAGER_USER_ID = pickId(managerUser);
    assert(!!MANAGER_USER_ID, 'manager user id should exist', reg);

    const roleRes = await request(
      'PATCH',
      `/api/admin/users/${MANAGER_USER_ID}/role`,
      { role: 'branch_manager', branchId: BRANCH_ID },
      ADMIN_TOKEN
    );
    assert(roleRes.status === 200, 'set branch_manager role should succeed', roleRes);

    const statusRes = await request(
      'PATCH',
      `/api/admin/users/${MANAGER_USER_ID}/status`,
      { status: 'active', reason: 'Activate branch manager test account' },
      ADMIN_TOKEN
    );
    assert(statusRes.status === 200, 'activate manager should succeed', statusRes);

    const loginRes = await request('POST', '/api/auth/login', {
      email: managerEmail,
      password: '123456',
    });
    assert(loginRes.body?.success === true, 'manager login success', loginRes);
    assert(
      loginRes.body?.data?.user?.role === 'branch_manager',
      'role should be branch_manager',
      loginRes
    );
    const userBranchId =
      pickId(loginRes.body?.data?.user?.branchId) ||
      loginRes.body?.data?.user?.branchId;
    assert(
      sameId(userBranchId, BRANCH_ID),
      'manager branchId should match BRANCH_ID',
      loginRes
    );
    MANAGER_TOKEN = loginRes.body.data.token;

    const getBranches = await request('GET', '/api/branches', null, MANAGER_TOKEN);
    assert(getBranches.status === 200, 'manager GET branches 200', getBranches);
    assert(getBranches.body?.success === true, 'manager GET success', getBranches);
    const branches = getBranches.body?.data?.branches || [];
    assert(
      Array.isArray(branches) && branches.length === 1,
      'manager should only see one branch',
      getBranches
    );
    if (branches.length === 1) {
      assert(
        sameId(pickId(branches[0]), BRANCH_ID),
        'visible branch should be BRANCH_ID',
        getBranches
      );
    }

    const postBranch = await request(
      'POST',
      '/api/branches',
      {
        name: `Manager Forbidden ${TS}`,
        address: 'Forbidden',
        latitude: 10,
        longitude: 106,
      },
      MANAGER_TOKEN
    );
    assert(postBranch.status === 403, 'manager POST branch 403', postBranch);
    assert(postBranch.body?.success === false, 'manager POST success false', postBranch);

    const getEmployees = await request(
      'GET',
      '/api/employees',
      null,
      MANAGER_TOKEN
    );
    assert(getEmployees.status === 200, 'manager GET employees 200', getEmployees);
    assert(getEmployees.body?.success === true, 'manager GET employees success', getEmployees);
    const employees = getEmployees.body?.data?.employees || [];
    const allInBranch = employees.every((emp) =>
      sameId(pickId(emp.branchId) || emp.branchId, BRANCH_ID)
    );
    assert(
      employees.length === 0 || allInBranch,
      'manager should only see employees in BRANCH_ID',
      getEmployees
    );
  });

  // 14. Branch manager cannot change role
  await runTest('14. Branch manager cannot change role', async () => {
    const res = await request(
      'PATCH',
      `/api/admin/users/${EMPLOYEE_USER_ID}/role`,
      { role: 'owner' },
      MANAGER_TOKEN
    );
    assert(res.status === 403, 'status should be 403', res);
    assert(res.body?.success === false, 'success should be false', res);
  });

  // 15. Admin lock employee
  await runTest('15. Admin lock employee', async () => {
    const lockRes = await request(
      'POST',
      `/api/admin/employees/${EMPLOYEE_USER_ID}/lock`,
      {},
      ADMIN_TOKEN
    );
    assert(lockRes.status === 200, 'lock should return 200', lockRes);
    assert(lockRes.body?.success === true, 'lock success true', lockRes);

    const loginRes = await request('POST', '/api/auth/login', {
      email: EMPLOYEE_EMAIL,
      password: '123456',
    });
    assert(loginRes.status === 403, 'locked employee login 403', loginRes);
    assert(loginRes.body?.success === false, 'locked login success false', loginRes);
  });

  // 16. Admin unlock employee
  await runTest('16. Admin unlock employee', async () => {
    const unlockRes = await request(
      'POST',
      `/api/admin/employees/${EMPLOYEE_USER_ID}/unlock`,
      {},
      ADMIN_TOKEN
    );
    assert(unlockRes.status === 200, 'unlock should return 200', unlockRes);
    assert(unlockRes.body?.success === true, 'unlock success true', unlockRes);

    const loginRes = await request('POST', '/api/auth/login', {
      email: EMPLOYEE_EMAIL,
      password: '123456',
    });
    assert(loginRes.status === 200, 'unlocked employee login 200', loginRes);
    assert(loginRes.body?.success === true, 'unlocked login success true', loginRes);
  });

  console.log('\n=== Summary ===');
  if (failed > 0) {
    console.log(`${failed} assertion(s) failed.`);
    process.exit(1);
  }

  console.log('All Phase 2 tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test runner crashed:', err.message);
  if (err.cause?.code === 'ECONNREFUSED') {
    console.error(
      'Cannot connect to server. Start with: npm run dev (in another terminal)'
    );
  }
  process.exit(1);
});
