import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Lock, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface MFALoginProps {
  onSuccess: (user: any) => void;
  onCancel: () => void;
}

const MFALogin: React.FC<MFALoginProps> = ({ onSuccess, onCancel }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFactor = async () => {
      if (!supabase) return;
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setError(error.message);
        return;
      }
      
      const totpFactor = data.all.find(f => f.factor_type === 'totp' && f.status === 'verified');
      if (totpFactor) {
        setFactorId(totpFactor.id);
      } else {
        setError('No verified MFA factor found for this account.');
      }
    };
    fetchFactor();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !factorId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;

      // session is now upgraded to AAL2
      const { data: { user } } = await supabase.auth.getUser();
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Failed to verify 2FA code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-12 text-center lg:text-left">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-blue-500/10 items-center justify-center mb-6">
          <Shield className="w-6 h-6 text-blue-500" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3 tracking-tighter">Two-Step Verification</h2>
        <p className="text-neutral-500 text-sm font-medium leading-relaxed">
          Your account is protected with MFA. Please enter the 6-digit code from your authenticator app.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg flex items-center gap-3 text-red-500 text-[13px] font-medium"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Authentication Code</label>
          <input 
            type="text"
            required
            autoFocus
            maxLength={6}
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
            placeholder="000000"
            className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder-neutral-800 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
          />
        </div>

        <button 
          type="submit"
          disabled={loading || verificationCode.length !== 6 || !factorId}
          className="w-full bg-white hover:bg-neutral-200 disabled:bg-white/10 disabled:text-neutral-600 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Verify & Sign In
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <button 
          type="button"
          onClick={onCancel}
          className="w-full text-neutral-500 hover:text-white font-bold py-2 transition-colors text-[10px] uppercase tracking-widest"
        >
          Back to Login
        </button>
      </form>
    </div>
  );
};

export default MFALogin;
