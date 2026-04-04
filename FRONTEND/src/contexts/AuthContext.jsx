import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('dtm_token')
      if (token) {
        try {
          const response = await api.getCurrentUser()
          setUser(response.user)
        } catch (err) {
          // Token invalid, clear it
          localStorage.removeItem('dtm_token')
          setUser(null)
        }
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const signup = async (name, email, password) => {
    try {
      setError(null)
      const response = await api.signup(name, email, password)
      if (response.token) {
        localStorage.setItem('dtm_token', response.token)
        setUser(response.user)
        return response
      }
      throw new Error(response.error || 'Signup failed')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const login = async (email, password) => {
    try {
      setError(null)
      const response = await api.login(email, password)
      if (response.token) {
        localStorage.setItem('dtm_token', response.token)
        setUser(response.user)
        return response
      }
      throw new Error(response.error || 'Login failed')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const logout = () => {
    api.logout()
    setUser(null)
    setError(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
