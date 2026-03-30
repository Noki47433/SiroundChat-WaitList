import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 1 },
    { duration: '30s', target: 2 },
    { duration: '40s', target: 5 },
    { duration: '20s', target: 0 },
  ],
};

const url = 'http://localhost:3000/api/builder/publish';

const cookie =
  'sb-jevqmewqvgcrrjrponwe-auth-token-code-verifier=%226a50148c5cba6d0c85274ac4d0e151e02e38a6ab934b23e866983fe886a93a44802e0e0b60a36b4acab80595d0c31e4aa3e18d358440b95c%2FPASSWORD_RECOVERY%22; sb-jevqmewqvgcrrjrponwe-auth-token=%5B%22eyJhbGciOiJFUzI1NiIsImtpZCI6IjY5MmJlNWFlLTRlYjgtNGYyYi1hMzMzLTFlNjMyOThjNGY4NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2pldnFtZXdxdmdjcnJqcnBvbndlLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI2M2JhZDY2My0yYWY2LTQ4NDQtYWNiYi0wYjkxODFiMWU5OWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc0ODA5NzM0LCJpYXQiOjE3NzQ4MDYxMzQsImVtYWlsIjoibm9hcnNpcm91bmRAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJidXNpbmVzc19uYW1lIjoiU2lyb3VuZENoYXQiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZnVsbF9uYW1lIjoibm9hcnNpcm91bmQiLCJpbmR1c3RyeSI6Im90aGVyIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NzQ3MjgzNDB9XSwic2Vzc2lvbl9pZCI6IjUzZTYwNTVkLTEyZmMtNDE1MC1iY2ExLTQ1YmU3YTJhODA5MiIsImlzX2Fub255bW91cyI6ZmFsc2V9.z7i8DPQgCUu9zOMz4GceZCZi7Gs_6v9VJVfyPqT3Su44yHvduZyQLACzulk94P3LhEbvnUNHcTxNRj2EjxJR_g%22%2C%22tbijwy26y4dt%22%2Cnull%2Cnull%2Cnull%5D';

const body = `{"siteId":"2be6c999-b3e2-47f4-869e-a5f675bb9c73"}`;

const params = {
  headers: {
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Connection: 'keep-alive',
    'Content-Type': 'application/json',
    Origin: 'http://localhost:3000',
    Referer: 'http://localhost:3000/editor/2be6c999-b3e2-47f4-869e-a5f675bb9c73',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    Cookie: cookie,
  },
};

export default function () {
  const res = http.post(url, body, params);

  check(res, {
    'publish status 200': (r) => r.status === 200,
    'publish returned url': (r) => {
      try {
        const json = JSON.parse(r.body);
        return typeof json.url === 'string' && json.url.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (res.status !== 200) {
    console.log(`FAIL publish status=${res.status} body=${res.body}`);
  }

  sleep(1);
}