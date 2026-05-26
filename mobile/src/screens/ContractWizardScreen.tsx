import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, EmptyState, Field, Heading, Pill, Screen, SectionTitle } from '../components/ui';
import { colors } from '../theme/colors';

export function ContractWizardScreen() {
  const [step, setStep] = useState(1);
  const [seller, setSeller] = useState('');
  const [buyer, setBuyer] = useState('');
  const [car, setCar] = useState('');
  const [vin, setVin] = useState('');
  const [price, setPrice] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractText, setContractText] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    Promise.all([
      apiClient.getContractTemplates().catch(() => ({ data: [] })),
      apiClient.getUserContracts().catch(() => ({ data: [] })),
    ]).then(([templateResponse, contractResponse]) => {
      setTemplates(templateResponse.data || []);
      setContracts(contractResponse.data || []);
    });
  }, []);

  const generate = async () => {
    setLoading(true);
    setStatus('');
    try {
      const response = await apiClient.generateCarContract({
        sellerName: seller,
        buyerName: buyer,
        carModel: car,
        carDetails: `${car} ${vin}`.trim(),
        vinNumber: vin,
        price,
        currency: 'IQD',
      });
      setContractText(response.data.contractText || '');
      setStep(3);
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
        contractText,
        sellerName: seller,
        buyerName: buyer,
        carModel: car,
        vinNumber: vin,
        price,
        currency: 'IQD',
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
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[1, 2, 3].map((item) => (
            <Pressable
              key={item}
              onPress={() => setStep(item)}
              style={{
                backgroundColor: step === item ? colors.navy : '#fff',
                borderColor: colors.line,
                borderRadius: 8,
                borderWidth: 1,
                flex: 1,
                padding: 10,
              }}
            >
              <Text style={{ color: step === item ? '#fff' : colors.ink, fontWeight: '900', textAlign: 'center' }}>
                {item === 1 ? 'الأطراف' : item === 2 ? 'المركبة' : 'المعاينة'}
              </Text>
            </Pressable>
          ))}
        </View>
        {templates.length || contracts.length ? (
          <>
            <SectionTitle title="القوالب والمسودات" />
            {templates.slice(0, 2).map((item, index) => (
              <Card key={item.id || index}>
                <Pill label="قالب" tone="blue" />
                <Text style={{ color: colors.ink, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{item.name || item.title}</Text>
              </Card>
            ))}
            {contracts.slice(0, 2).map((item) => (
              <Card key={item.id}>
                <Pill label={item.status || 'مسودة'} tone="gold" />
                <Text style={{ color: colors.ink, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{item.title || item.type || 'عقد محفوظ'}</Text>
              </Card>
            ))}
          </>
        ) : null}
        <Card>
          {step === 1 ? (
            <>
              <Field value={seller} onChangeText={setSeller} placeholder="اسم البائع" />
              <Field value={buyer} onChangeText={setBuyer} placeholder="اسم المشتري" />
              <Button title="التالي" onPress={() => setStep(2)} />
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Field value={car} onChangeText={setCar} placeholder="نوع وتفاصيل المركبة" />
              <Field value={vin} onChangeText={setVin} placeholder="رقم الشاصي" />
              <Field value={price} onChangeText={setPrice} placeholder="السعر" />
              <Button title="إنشاء العقد" onPress={generate} loading={loading} />
            </>
          ) : null}
          {step === 3 && !contractText ? <EmptyState title="لم يتم إنشاء العقد بعد" note="أكمل بيانات الأطراف والمركبة ثم اضغط إنشاء العقد." /> : null}
        </Card>
        {step === 3 && contractText ? (
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
