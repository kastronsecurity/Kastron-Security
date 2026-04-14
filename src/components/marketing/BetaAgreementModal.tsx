import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Shield, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

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
          {/* Grid Background */}
          <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]" 
               style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="bg-black border border-white/10 rounded-xl p-8 max-w-2xl w-full shadow-2xl my-8 relative z-10"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Beta Agreement</h2>
                  <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest">KastronSec Platform</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-md transition-colors text-neutral-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-6 h-80 overflow-y-auto mb-8 scrollbar-hide">
              <div className="prose prose-invert prose-sm max-w-none space-y-6 text-neutral-400 font-medium text-[13px] leading-relaxed">
                <div className="text-center border-b border-white/5 pb-6 mb-6">
                  <h3 className="text-white font-bold text-base mb-1 tracking-tight">TERMS OF SERVICE & NON-DISCLOSURE AGREEMENT</h3>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-500">Last Updated: April 2026</p>
                </div>

                <section>
                  <h4 className="text-white font-bold mb-2 tracking-tight">1. ACCEPTANCE OF TERMS</h4>
                  <p>By creating an account on KastronSec Beta, you agree to be bound by these Terms of Service and Non-Disclosure Agreement. If you do not agree, you may not use the platform.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2 tracking-tight">2. BETA PROGRAM</h4>
                  <p>You acknowledge that this is a beta version of KastronSec and may contain bugs or incomplete features. Features may change or become paid at any time. The beta is provided free of charge for testing purposes only.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2 tracking-tight">3. DATA RETENTION</h4>
                  <p>All data including alerts, agents, cases and logs are retained for a maximum of 30 days. After 30 days data will be permanently deleted without recovery. KastronSec is not responsible for any data loss after the 30-day retention period.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2 tracking-tight">4. NON-DISCLOSURE AGREEMENT</h4>
                  <p>You agree to keep strictly confidential any bugs, vulnerabilities, screenshots, internal features, pricing or architecture information. You agree NOT to publicly share screenshots, discuss vulnerabilities publicly, reverse engineer the platform, share credentials, or use the platform for illegal activities.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2 tracking-tight">5. RESPONSIBLE DISCLOSURE</h4>
                  <p>If you discover a security vulnerability report it privately to kastronsec@gmail.com. Do not exploit or publicly disclose it. Allow KastronSec 90 days to fix the issue.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2 tracking-tight">6. ACCEPTABLE USE</h4>
                  <p>You agree not to use KastronSec to monitor systems you do not own, conduct illegal surveillance, or violate any applicable laws.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2 tracking-tight">7. LIMITATION OF LIABILITY</h4>
                  <p>KastronSec is provided as is during beta. KastronSec shall not be liable for any data loss, service interruption, or damages arising from use of the beta platform.</p>
                </section>

                <section>
                  <h4 className="text-white font-bold mb-2 tracking-tight">8. GOVERNING LAW</h4>
                  <p>These terms are governed by the laws of Sri Lanka.</p>
                </section>
              </div>
            </div>

            <div className="space-y-4 mb-10">
              {[
                { id: 'terms', checked: agreedToTerms, setter: setAgreedToTerms, label: "I have read and agree to the Terms of Service" },
                { id: 'nda', checked: agreedToNDA, setter: setAgreedToNDA, label: "I agree to the Beta NDA and confidentiality" },
                { id: 'retention', checked: understoodRetention, setter: setUnderstoodRetention, label: "I understand the 30-day data retention policy" }
              ].map((item) => (
                <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={item.checked}
                      onChange={() => item.setter(!item.checked)}
                    />
                    <div className={cn(
                      "w-4 h-4 rounded border transition-all flex items-center justify-center",
                      item.checked ? "bg-white border-white" : "border-white/10 bg-black group-hover:border-white/30"
                    )}>
                      {item.checked && <Check className="w-3 h-3 text-black stroke-[3]" />}
                    </div>
                  </div>
                  <span className="text-[13px] text-neutral-400 group-hover:text-neutral-200 transition-colors font-medium">{item.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-3 bg-black hover:bg-white/5 text-white rounded-md font-bold text-[13px] transition-all border border-white/10"
              >
                Cancel
              </button>
              <button 
                onClick={onAgree}
                disabled={!isAllChecked}
                className={cn(
                  "flex-1 py-3 rounded-md font-bold text-[13px] transition-all",
                  isAllChecked 
                    ? "bg-white text-black hover:bg-neutral-200" 
                    : "bg-white/5 text-neutral-600 cursor-not-allowed border border-white/5"
                )}
              >
                Agree & Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
