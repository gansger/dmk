import { appendEvent, read, write } from '../core/store.js';
import { readBody, routeParams, sendJson, sendNoContent } from '../core/http.js';
import { nextTeacherOrder, normalizeTeacher, publicTeachers, reorderTeachers, sortedTeachers } from '../domain/teachers.js';

export async function handleTeachersApi({ request, response, method, pathname }) {
  if (method === 'GET' && pathname === '/api/public/teachers') {
    sendJson(response, 200, publicTeachers(await read('teachers')));
    return true;
  }

  if (method === 'GET' && pathname === '/api/teachers') {
    sendJson(response, 200, sortedTeachers(await read('teachers')));
    return true;
  }

  if (method === 'POST' && pathname === '/api/teachers') {
    const body = await readBody(request);
    const teachers = await read('teachers');
    const teacher = normalizeTeacher({ ...body, order: nextTeacherOrder(teachers) });
    if (!teacher.name) {
      sendJson(response, 400, { error: 'Укажите ФИО педагога.' });
      return true;
    }
    await write('teachers', [...teachers, teacher]);
    await appendEvent('teacher.created', { id: teacher.id, name: teacher.name });
    sendJson(response, 201, teacher);
    return true;
  }

  if (method === 'POST' && pathname === '/api/teachers/order') {
    const body = await readBody(request);
    const teachers = reorderTeachers(await read('teachers'), Array.isArray(body.ids) ? body.ids : []);
    await write('teachers', teachers);
    await appendEvent('teachers.reordered', { count: teachers.length });
    sendJson(response, 200, sortedTeachers(teachers));
    return true;
  }

  const params = routeParams('/api/teachers/:id', pathname);
  if (params && method === 'PUT') {
    const body = await readBody(request);
    const teachers = await read('teachers');
    const index = teachers.findIndex((item) => item.id === params.id);
    if (index === -1) {
      sendJson(response, 404, { error: 'Педагог не найден' });
      return true;
    }
    const teacher = normalizeTeacher(body, teachers[index]);
    if (!teacher.name) {
      sendJson(response, 400, { error: 'Укажите ФИО педагога.' });
      return true;
    }
    teachers[index] = teacher;
    await write('teachers', teachers);
    await appendEvent('teacher.updated', { id: teacher.id, name: teacher.name });
    sendJson(response, 200, teacher);
    return true;
  }

  if (params && method === 'DELETE') {
    const teachers = await read('teachers');
    if (!teachers.some((item) => item.id === params.id)) {
      sendJson(response, 404, { error: 'Педагог не найден' });
      return true;
    }
    await write('teachers', teachers.filter((item) => item.id !== params.id));
    await appendEvent('teacher.deleted', { id: params.id });
    sendNoContent(response);
    return true;
  }

  return false;
}
