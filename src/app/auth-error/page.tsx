import Link from 'next/link'

export default function AuthError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
        <p className="text-gray-700 mb-6">
          Sorry, we couldn't sign you in. The link might have expired or been used already.
        </p>
        <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Go back to Login
        </Link>
      </div>
    </div>
  )
} 