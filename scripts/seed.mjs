import bcrypt from 'bcryptjs'

const accounts = [
  { username: 'ceo',    name: '대표',       role: 'ceo',   password: 'ceo1234' },
  { username: 'sales1', name: '영업팀 1번', role: 'sales', password: 'sales1234' },
  { username: 'sales2', name: '영업팀 2번', role: 'sales', password: 'sales1234' },
  { username: 'ops1',   name: '관리팀 1번', role: 'ops',   password: 'ops1234' },
]

for (const acc of accounts) {
  const hash = await bcrypt.hash(acc.password, 10)
  console.log(`INSERT INTO users (username, name, password_hash, role) VALUES ('${acc.username}', '${acc.name}', '${hash}', '${acc.role}');`)
}
