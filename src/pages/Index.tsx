import React from 'react';
import { S } from '../someDependency';

const Index = () => {
  // other lines of code

  const shouldOnboard = !S.me || (!S.onboarded && !S.chars[S.me]?.onboarded);

  // other lines of code
};

export default Index;