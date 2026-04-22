import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, CheckCircle2, AlertCircle, Trash2, Key, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export const MFASettings: React.FC = () => {
  const [factors, setFactors] = useState<any[]>([]);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false);
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFactors();
  }, []);

  const fetchFactors = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.error('Error fetching MFA factors:', error);
      return;
    }
    setFactors(data.all);
  };

  const startEnrollment = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });
      if (error) throw error;
      setEnrollmentData(data);
      setShowEnrollment(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!supabase || !enrollmentData) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollmentData.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollmentData.id,
        challengeId: data.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;

      setShowEnrollment(false);
      setEnrollmentData(null);
      setVerificationCode('');
      fetchFactors();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startUnenroll = (factorId: string) => {
    setSelectedFactorId(factorId);
    setVerificationCode('');
    setShowUnenrollConfirm(true);
    setError(null);
  };

  const confirmUnenroll = async () => {
    if (!supabase || !selectedFactorId) return;
    setLoading(true);
    setError(null);
    try {
      // First challenge the user to prove they have the device
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: selectedFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: selectedFactorId,
        challengeId: data.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;

      // Now unenroll
      const { error } = await supabase.auth.mfa.unenroll({ factorId: selectedFactorId });
      if (error) throw error;
      
      setShowUnenrollConfirm(false);
      setSelectedFactorId(null);
      setVerificationCode('');
      fetchFactors();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#0a0a0a] border border-neutral-800 rounded-xl overflow-hidden mt-6">
      <div className="p-6 border-b border-neutral-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          Two-Step Verification (MFA)
        </h2>
        <p className="text-sm text-neutral-400 mt-1">Add an extra layer of security to your account using TOTP (Google Authenticator, Authy, etc).</p>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg flex items-center gap-3 text-red-500 text-xs font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {factors.length > 0 ? (
          <div className="space-y-4">
            {factors.map((factor) => (
              <div key={factor.id} className="flex items-center justify-between p-4 bg-neutral-900/40 border border-neutral-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Authenticator App</h3>
                    <p className="text-[10px] text-neutral-500 font-medium">Status: {factor.status.toUpperCase()}</p>
                  </div>
                </div>
                <button
                  onClick={() => startUnenroll(factor.id)}
                  className="p-2 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Disable MFA"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-lg">
              <p className="text-[11px] text-green-400 leading-relaxed font-medium">
                <span className="font-bold uppercase mr-2">Status:</span> 
                Your account is currently protected by two-step verification.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-6 border-2 border-dashed border-neutral-800 rounded-xl text-center">
              <Key className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
              <h3 className="text-white font-bold text-sm mb-2 uppercase tracking-widest">Setup Two-Step Verification</h3>
              <p className="text-neutral-500 text-xs mb-6 max-w-sm mx-auto">
                Protect your account by requiring an additional security code from your phone whenever you sign in.
              </p>
              <button
                onClick={startEnrollment}
                disabled={loading}
                className="px-6 py-2 bg-white text-black font-bold rounded-lg text-[10px] uppercase tracking-widest hover:bg-neutral-200 transition-all disabled:opacity-50"
              >
                {loading ? 'Initializing...' : 'Enable 2FA'}
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showEnrollment && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full relative">
                <div className="text-center mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Scan QR Code</h3>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    Open your verification app (Google Authenticator, Authy, or Microsoft Authenticator) and scan the code below.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-8 w-fit flex items-center justify-center">
                  <QRCodeSVG value={enrollmentData.totp.uri} size={180} />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Enter Verification Code</label>
                    <input
                      type="text"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                      className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-center text-lg font-mono tracking-[0.5em] text-white focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowEnrollment(false)}
                      className="flex-1 px-4 py-3 border border-neutral-800 text-neutral-400 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={verifyEnrollment}
                      disabled={loading || verificationCode.length !== 6}
                      className="flex-1 px-4 py-3 bg-white text-black font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-neutral-200 transition-all disabled:opacity-20"
                    >
                      {loading ? 'Verifying...' : 'Complete Setup'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showUnenrollConfirm && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full relative">
                <div className="text-center mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Disable Verification</h3>
                  <p className="text-neutral-400 text-xs leading-relaxed font-medium">
                    To disable Two-Step Verification, please enter the current 6-digit code from your authenticator app to authorize this action.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Authenticator Code</label>
                    <input
                      type="text"
                      placeholder="000 000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] text-white focus:outline-none focus:border-red-500 transition-all placeholder:text-neutral-800"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowUnenrollConfirm(false);
                        setSelectedFactorId(null);
                        setVerificationCode('');
                      }}
                      className="flex-1 px-4 py-4 border border-neutral-800 text-neutral-400 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmUnenroll}
                      disabled={loading || verificationCode.length !== 6}
                      className="flex-1 px-4 py-4 bg-red-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-red-500 transition-all disabled:opacity-20"
                    >
                      {loading ? 'Verifying...' : 'Verify & Disable'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
