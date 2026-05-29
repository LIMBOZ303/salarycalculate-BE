/**
 * Phase 3: Shift + Attendance + GPS flow tests
 * Prerequisites: server running, MongoDB, admin seeded
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TS = Date.now();

const BRANCH_LAT = 10.762622;
const BRANCH_LNG = 106.660172;
const FAR_LAT = 10.9;
const FAR_LNG = 106.9;

const GPS_OK = {
  latitude: BRANCH_LAT,
  longitude: BRANCH_LNG,
  accuracy: 25,
  deviceInfo: { deviceId: 'test-device', deviceName: 'Test', platform: 'test' },
};

let failed = 0;

const createRandomEmail = (prefix) => `${prefix}_${TS}@gmail.com`;

const pickId = (obj) => {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  return obj._id || obj.id || null;
};

const sameId = (a, b) => String(a) === String(b);

const logPass = (msg) => console.log(`  PASS: ${msg}`);
const logFail = (msg, res) => {
  failed += 1;
  console.log(`  FAIL: ${msg}`);
  if (res) {
    console.log(`        status: ${res.status}`);
    console.log(`        body: ${JSON.stringify(res.body, null, 2)}`);
  }
};

const assert = (cond, msg, res) => (cond ? logPass(msg) : logFail(msg, res));

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const options = { method, headers };
  if (body && method !== 'GET') options.body = JSON.stringify(body);

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
    return { status: 0, body: { success: false, message: hint }, ok: false };
  }
}

async function runTest(name, fn) {
  console.log(`\n[${name}]`);
  try {
    await fn();
  } catch (e) {
    logFail(`${name}: ${e.message}`);
    console.error(e);
  }
}

async function setupApprovedEmployee(adminToken, shiftId, branchLat = BRANCH_LAT, branchLng = BRANCH_LNG) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `emp_att_${TS}_${suffix}@gmail.com`;

  const branchRes = await request(
    'POST',
    '/api/branches',
    {
      name: `Att Branch ${TS}_${Math.random().toString(36).slice(2, 6)}`,
      address: 'Test GPS Address',
      phone: '0901111222',
      latitude: branchLat,
      longitude: branchLng,
      allowedRadiusMeters: 200,
    },
    adminToken
  );
  const branchId = pickId(branchRes.body?.data?.branch || branchRes.body?.data);

  await request('POST', '/api/auth/register', {
    fullName: `Att Employee ${TS}`,
    phone: `09${String(TS + Math.floor(Math.random() * 1000)).slice(-8)}`,
    email,
    password: '123456',
  });

  const usersRes = await request('GET', '/api/admin/employees/pending', null, adminToken);
  const users = usersRes.body?.data?.users || [];
  const user = users.find((u) => u.email === email);
  const userId = pickId(user);

  await request(
    'POST',
    `/api/admin/employees/${userId}/approve`,
    {
      branchId,
      position: 'Nhân viên test',
      hourlyRate: 27000,
      shiftId: shiftId || null,
      startDate: '2026-01-01',
      note: 'Phase 3 test',
    },
    adminToken
  );

  const loginRes = await request('POST', '/api/auth/login', { email, password: '123456' });
  const token = loginRes.body?.data?.token;

  return { email, userId, branchId, token };
}

async function main() {
  if (typeof fetch === 'undefined') {
    console.error('Cần Node.js 18+ (fetch built-in)');
    process.exit(1);
  }

  console.log('=== Phase 3 Attendance Flow Tests ===');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Timestamp: ${TS}`);

  let ADMIN_TOKEN = null;
  let SHIFT_ID = null;
  let BRANCH_ID = null;
  let EMPLOYEE_TOKEN = null;
  let EMPLOYEE_USER_ID = null;
  let OWNER_TOKEN = null;
  let MANAGER_TOKEN = null;

  await runTest('1. GET /', async () => {
    const res = await request('GET', '/');
    assert(res.ok !== false, 'server reachable', res);
    assert(res.status === 200 && res.body?.success === true, 'health ok', res);
  });

  await runTest('2. Admin login', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@gmail.com',
      password: '123456',
    });
    assert(res.status === 200 && res.body?.data?.token, 'admin login', res);
    ADMIN_TOKEN = res.body?.data?.token || null;
  });

  if (!ADMIN_TOKEN) {
    console.error('Run: npm run seed');
    process.exit(1);
  }

  await runTest('3. Get or create shift', async () => {
    const list = await request('GET', '/api/shifts', null, ADMIN_TOKEN);
    assert(list.status === 200, 'list shifts', list);
    const shifts = list.body?.data?.shifts || [];
    if (shifts.length > 0) {
      SHIFT_ID = pickId(shifts[0]);
      logPass(`using shift ${SHIFT_ID}`);
    } else {
      const created = await request(
        'POST',
        '/api/shifts',
        {
          name: `Test Shift ${TS}`,
          startTime: '08:00',
          endTime: '16:00',
          breakMinutes: 30,
          graceMinutes: 10,
        },
        ADMIN_TOKEN
      );
      SHIFT_ID = pickId(created.body?.data?.shift);
      assert(!!SHIFT_ID, 'created shift', created);
    }
  });

  await runTest('4-8. Setup employee + today before check-in', async () => {
    const setup = await setupApprovedEmployee(ADMIN_TOKEN, SHIFT_ID);
    EMPLOYEE_TOKEN = setup.token;
    EMPLOYEE_USER_ID = setup.userId;
    BRANCH_ID = setup.branchId;
    assert(!!EMPLOYEE_TOKEN, 'employee token', { status: 200, body: {} });

    const today = await request('GET', '/api/attendance/me/today', null, EMPLOYEE_TOKEN);
    assert(today.status === 200, 'today status 200', today);
    const st = today.body?.data?.status;
    assert(
      st === 'not_checked_in' || today.body?.data?.attendance === null,
      'not checked in yet',
      today
    );
  });

  await runTest('9. Employee check-in (valid GPS)', async () => {
    const res = await request('POST', '/api/attendance/check-in', GPS_OK, EMPLOYEE_TOKEN);
    assert([200, 201].includes(res.status), 'check-in success status', res);
    assert(res.body?.success === true, 'check-in success', res);
  });

  await runTest('10. Duplicate check-in blocked', async () => {
    const res = await request('POST', '/api/attendance/check-in', GPS_OK, EMPLOYEE_TOKEN);
    assert(res.status === 400, 'duplicate check-in 400', res);
    assert(res.body?.success === false, 'duplicate fail', res);
  });

  await runTest('11. GET today after check-in', async () => {
    const res = await request('GET', '/api/attendance/me/today', null, EMPLOYEE_TOKEN);
    const st = res.body?.data?.status || res.body?.data?.attendance?.status;
    assert(
      ['checked_in', 'late'].includes(st),
      'status checked_in or late',
      res
    );
  });

  await runTest('12. Employee check-out (valid GPS)', async () => {
    const res = await request('POST', '/api/attendance/check-out', GPS_OK, EMPLOYEE_TOKEN);
    assert(res.status === 200, 'check-out 200', res);
    assert(res.body?.success === true, 'check-out success', res);
  });

  await runTest('13. Duplicate check-out blocked', async () => {
    const res = await request('POST', '/api/attendance/check-out', GPS_OK, EMPLOYEE_TOKEN);
    assert(res.status === 400, 'duplicate check-out 400', res);
    assert(res.body?.success === false, 'duplicate checkout fail', res);
  });

  await runTest('14. Monthly summary has totalHours', async () => {
    const now = new Date();
    const res = await request(
      'GET',
      `/api/attendance/me/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
      null,
      EMPLOYEE_TOKEN
    );
    assert(res.status === 200, 'summary 200', res);
    assert(
      res.body?.data?.totalHours != null && res.body.data.totalHours >= 0,
      'totalHours exists',
      res
    );
  });

  await runTest('15. History contains attendance', async () => {
    const now = new Date();
    const res = await request(
      'GET',
      `/api/attendance/me/history?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
      null,
      EMPLOYEE_TOKEN
    );
    const history = res.body?.data?.history || [];
    assert(history.length >= 1, 'history has records', res);
  });

  await runTest('16. Check-in outside radius blocked', async () => {
    const setup = await setupApprovedEmployee(ADMIN_TOKEN, SHIFT_ID);
    const res = await request(
      'POST',
      '/api/attendance/check-in',
      {
        latitude: FAR_LAT,
        longitude: FAR_LNG,
        accuracy: 25,
        deviceInfo: GPS_OK.deviceInfo,
      },
      setup.token
    );
    assert(res.status === 403, 'outside radius 403', res);
    assert(res.body?.success === false, 'outside radius fail', res);
  });

  await runTest('17. Employee cannot list attendances', async () => {
    const res = await request('GET', '/api/attendance', null, EMPLOYEE_TOKEN);
    assert(res.status === 403, 'employee list 403', res);
    assert(res.body?.success === false, 'employee list fail', res);
  });

  await runTest('18. Admin can list attendances', async () => {
    const res = await request('GET', '/api/attendance', null, ADMIN_TOKEN);
    assert(res.status === 200, 'admin list 200', res);
    assert(res.body?.success === true, 'admin list success', res);
  });

  await runTest('19. Owner read-only on attendance', async () => {
    const ownerEmail = createRandomEmail('owner_att');
    await request('POST', '/api/auth/register', {
      fullName: `Owner Att ${TS}`,
      phone: '0907777777',
      email: ownerEmail,
      password: '123456',
    });
    const pending = await request('GET', '/api/admin/employees/pending', null, ADMIN_TOKEN);
    const ou = (pending.body?.data?.users || []).find((u) => u.email === ownerEmail);
    const ownerId = pickId(ou);
    await request(
      'PATCH',
      `/api/admin/users/${ownerId}/role`,
      { role: 'owner' },
      ADMIN_TOKEN
    );
    await request(
      'PATCH',
      `/api/admin/users/${ownerId}/status`,
      { status: 'active', reason: 'test' },
      ADMIN_TOKEN
    );
    const login = await request('POST', '/api/auth/login', {
      email: ownerEmail,
      password: '123456',
    });
    OWNER_TOKEN = login.body?.data?.token;

    const getRes = await request('GET', '/api/attendance', null, OWNER_TOKEN);
    assert(getRes.status === 200, 'owner GET 200', getRes);

    const attendances = getRes.body?.data?.attendances || [];
    const attId = pickId(attendances[0]);
    if (attId) {
      const putRes = await request(
        'PUT',
        `/api/attendance/${attId}`,
        { reason: 'owner hack', checkInTime: new Date().toISOString() },
        OWNER_TOKEN
      );
      assert(putRes.status === 403, 'owner PUT 403', putRes);
    } else {
      logPass('no attendance to PUT (skip)');
    }
  });

  await runTest('20. Branch manager branch scope', async () => {
    const mgrEmail = createRandomEmail('mgr_att');
    await request('POST', '/api/auth/register', {
      fullName: `Manager Att ${TS}`,
      phone: '0906666666',
      email: mgrEmail,
      password: '123456',
    });
    const pending = await request('GET', '/api/admin/employees/pending', null, ADMIN_TOKEN);
    const mu = (pending.body?.data?.users || []).find((u) => u.email === mgrEmail);
    const mgrId = pickId(mu);
    await request(
      'PATCH',
      `/api/admin/users/${mgrId}/role`,
      { role: 'branch_manager', branchId: BRANCH_ID },
      ADMIN_TOKEN
    );
    await request(
      'PATCH',
      `/api/admin/users/${mgrId}/status`,
      { status: 'active', reason: 'test' },
      ADMIN_TOKEN
    );
    const login = await request('POST', '/api/auth/login', {
      email: mgrEmail,
      password: '123456',
    });
    MANAGER_TOKEN = login.body?.data?.token;

    const branches = await request('GET', '/api/branches', null, MANAGER_TOKEN);
    const list = branches.body?.data?.branches || [];
    assert(list.length === 1 && sameId(pickId(list[0]), BRANCH_ID), 'one branch only', branches);

    const emps = await request('GET', '/api/employees', null, MANAGER_TOKEN);
    const employees = emps.body?.data?.employees || [];
    const allMine = employees.every((e) =>
      sameId(pickId(e.branchId) || e.branchId, BRANCH_ID)
    );
    assert(employees.length === 0 || allMine, 'employees in branch only', emps);

    const postBr = await request(
      'POST',
      '/api/branches',
      { name: 'X', address: 'X', latitude: 10, longitude: 106 },
      MANAGER_TOKEN
    );
    assert(postBr.status === 403, 'manager cannot create branch', postBr);
  });

  console.log('\n=== Summary ===');
  if (failed > 0) {
    console.log(`${failed} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('All Phase 3 tests passed');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
