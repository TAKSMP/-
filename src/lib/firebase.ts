// =============================================================
//  つうしんバトル用の Firebase 初期化
// -------------------------------------------------------------
//  ・Realtime Database：たいせんの部屋（へや）の じょうたいを やりとり
//  ・Authentication（匿名）：だれが 書きこんだかを くべつする ため だけ
//  ここに ある キーは「公開されても よい」クライアント設定です。
//  実際の あんぜんせいは Realtime Database の ルールで まもります。
// =============================================================
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, type User } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyCfAbu39rbba__8cpZJuTY-03ZpaYTAR8U',
  authDomain: 'chomushi-battle.firebaseapp.com',
  databaseURL: 'https://chomushi-battle-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'chomushi-battle',
  storageBucket: 'chomushi-battle.firebasestorage.app',
  messagingSenderId: '104100503651',
  appId: '1:104100503651:web:4dc7c63c9d785600edd856',
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
const auth = getAuth(app)

// さいしょの 1かいだけ サインインする（2回目いこうは おなじ Promise を かえす）
let signInPromise: Promise<User> | null = null
export function ensureSignedIn(): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  if (!signInPromise) {
    signInPromise = signInAnonymously(auth).then((cred) => cred.user)
  }
  return signInPromise
}

export function currentUid(): string | null {
  return auth.currentUser?.uid ?? null
}
