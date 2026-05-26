import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Field, Heading, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function ContractWizardScreen() {
  const [seller, setSeller] = useState('');
  const [buyer, setBuyer] = useState('');
  const [car, setCar] = useState('');
  const [price, setPrice] = useState('');
  const [contractText, setContractText] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const generate = async () => {
    setLoading(true);
    setStatus('');
    try {
      const response = await apiClient.generateCarContract({
        sellerName: seller,
        buyerName: buyer,
        carDetails: car,
        price,
      });
      setContractText(response.data.contractText || '');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إنشاء العقد.');
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    setLoading(true);
    try {
      await apiClient.saveDraftContract({
        title: `عقد بيع مركبة - ${buyer || 'مسودة'}`,
        type: 'car',
        content: contractText,
      });
      setStatus('تم حفظ العقد كمسودة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر حفظ المسودة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView>
        <Heading title="منشئ العقود" subtitle="ابدأ بعقد بيع مركبة، ثم احفظ المسودة للمراجعة." />
        <Card>
          <Field value={seller} onChangeText={setSeller} placeholder="اسم البائع" />
          <Field value={buyer} onChangeText={setBuyer} placeholder="اسم المشتري" />
          <Field value={car} onChangeText={setCar} placeholder="تفاصيل المركبة" />
          <Field value={price} onChangeText={setPrice} placeholder="السعر" />
          <Button title="إنشاء العقد" onPress={generate} loading={loading} />
        </Card>
        {contractText ? (
          <Card>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 10, textAlign: 'right' }}>معاينة العقد</Text>
            <Text style={{ color: colors.muted, lineHeight: 23, textAlign: 'right' }}>{contractText}</Text>
            <Text>{'\n'}</Text>
            <Button title="حفظ كمسودة" onPress={saveDraft} loading={loading} variant="secondary" />
          </Card>
        ) : null}
        {status ? <Text style={{ color: colors.navy, fontWeight: '800', textAlign: 'center' }}>{status}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

