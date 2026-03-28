import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  let res = http.get('https://siroundchat.com');

  check(res, {
    'homepage loaded': (r) => r.status === 200,
  });

  let api = http.post(
    'https://siroundchat.com/api/chat/send',
    JSON.stringify({
      message: 'Hello',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  console.log(`chat status: ${api.status}`);
  console.log(`chat body: ${api.body}`);

  check(api, {
    'chat API works': (r) => r.status === 200,
  });

  sleep(1);
}