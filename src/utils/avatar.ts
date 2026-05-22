export function getInitialsAvatar(name = 'User', background = '0d2a59') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${background}&color=ffffff&rounded=true&font-size=0.4`;
}

export function getProfileImage(entity?: {
  img?: string | null;
  avatar?: string | null;
  name?: string | null;
  lawyerProfile?: {
    avatar?: string | null;
  } | null;
} | null) {
  return entity?.img || entity?.avatar || entity?.lawyerProfile?.avatar || getInitialsAvatar(entity?.name || 'User');
}
