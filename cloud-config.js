
window.VGP_CLOUD = Object.freeze({
  enabled: true,
  url: 'https://rjzicbqptenxscezlnkk.supabase.co',
  publicKey: 'sb_publishable_0FliLXIlEb2sJEjJClc-EA_8ZerUpvu',
  workspaceId: '3277b938-f830-44c7-b8b1-4041d7d76da7'
});

if (window.VGP_CLOUD.enabled) {
  document.documentElement.classList.add('cloud-locked');
}
