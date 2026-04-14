import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Shield, AlertCircle } from 'lucide-react';

interface BetaAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
}

export default function BetaAgreementModal({ isOpen, onClose, onAgree }: BetaAgreementModalProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToNDA, setAgreedToNDA] = useState(false);
  const [understoodRetention, setUnderstoodRetention] = useState(false);

  const isAllChecked = agreedToTerms && agreedToNDA && understoodRetention;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#0a0a0a] border border-neutral-800 rounded-3xl p-8 max-w-2xl w-full shadow-2xl my-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-white">KastronSec Beta Agreement</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-black border border-neutral-800 rounded-2xl p-6 h-80 overflow-y-auto mb-8 scrollbar-hide">
              <div className="prose prose-invert prose-sm max-w-none space-y-6 text-neutral-400">
                <div className="text-center border-b border-neutral-800 pb-6 mb-6">
                  <h3 className="text-white font-bold text-lg mb-1">KASTRONSEC BETA TERMS OF SERVICE & NON-DISCLOSURE AGREEMENT</h3>
                  <p className="text-xs uppercase tracking-widest font-bold text-neutral-500">Last Updated: April 2026</p>
                  <p className="text-xs text-neutral-600">Company: KastronSec | Contact: kastronsec@gmail.com</p>
                </div>

                <section>
                  <h4 className="text-white font-bold mb-2">1. ACCEPTANCE OF TERMS</h4>
                  <p>By creating an account on KastronSec Beta, you agree to be bound by these Terms of Service and Non-Disclosure Agreement. If you do not agree, you may not use the platform.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2">2. BETA PROGRAM</h4>
                  <p>You acknowledge that this is a beta version of KastronSec and may contain bugs or incomplete features. Features may change or become paid at any time. The beta is provided free of charge for testing purposes only.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2">3. DATA RETENTION</h4>
                  <p>All data including alerts, agents, cases and logs are retained for a maximum of 30 days. After 30 days data will be permanently deleted without recovery. KastronSec is not responsible for any data loss after the 30-day retention period.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2">4. NON-DISCLOSURE AGREEMENT</h4>
                  <p>You agree to keep strictly confidential any bugs, vulnerabilities, screenshots, internal features, pricing or architecture information. You agree NOT to publicly share screenshots, discuss vulnerabilities publicly, reverse engineer the platform, share credentials, or use the platform for illegal activities.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2">5. RESPONSIBLE DISCLOSURE</h4>
                  <p>If you discover a security vulnerability report it privately to kastronsec@gmail.com. Do not exploit or publicly disclose it. Allow KastronSec 90 days to fix the issue.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2">6. ACCEPTABLE USE</h4>
                  <p>You agree not to use KastronSec to monitor systems you do not own, conduct illegal surveillance, or violate any applicable laws.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2">7. LIMITATION OF LIABILITY</h4>
                  <p>KastronSec is provided as is during beta. KastronSec shall not be liable for any data loss, service interruption, or damages arising from use of the beta platform.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2">8. GOVERNING LAW</h4>
                  <p>These terms are governed by the laws of Sri Lanka.</p>
                </section>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-1">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={agreedToTerms}
                    onChange={() => setAgreedToTerms(!agreedToTerms)}
                  />
                  <div className={`w-5 h-5 rounded border transition-all ${agreedToTerms ? 'bg-blue-600 border-blue-600' : 'border-neutral-700 bg-neutral-900 group-hover:border-neutral-500'}`}>
                    {agreedToTerms && <Check className="w-3.5 h-3.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                  </div>
                </div>
                <span className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">I have read and agree to the KastronSec Terms of Service</span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-1">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={agreedToNDA}
                    onChange={() => setAgreedToNDA(!agreedToNDA)}
                  />
                  <div className={`w-5 h-5 rounded border transition-all ${agreedToNDA ? 'bg-blue-600 border-blue-600' : 'border-neutral-700 bg-neutral-900 group-hover:border-neutral-500'}`}>
                    {agreedToNDA && <Check className="w-3.5 h-3.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                  </div>
                </div>
                <span className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">I agree to the Beta NDA and will keep all platform details confidential</span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-1">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={understoodRetention}
                    onChange={() => setUnderstoodRetention(!understoodRetention)}
                  />
                  <div className={`w-5 h-5 rounded border transition-all ${understoodRetention ? 'bg-blue-600 border-blue-600' : 'border-neutral-700 bg-neutral-900 group-hover:border-neutral-500'}`}>
                    {understoodRetention && <Check className="w-3.5 h-3.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                  </div>
                </div>
                <span className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">I understand that all my data will be permanently deleted after 30 days</span>
              </label>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl font-bold transition-all border border-neutral-800"
              >
                Cancel
              </button>
              <button 
                onClick={onAgree}
                disabled={!isAllChecked}
                className={`flex-1 py-4 rounded-2xl font-bold transition-all shadow-xl ${
                  isAllChecked 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20' 
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              >
                I Agree — Continue to Sign Up
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
