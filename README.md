# kymetaOW-monitor

Ruteo Basado en Políticas en Raspberry Pi
Esta configuración permite que el tráfico con origen en 192.168.10.30 utilice una tabla de rutas personalizada para salir por la puerta de enlace 192.168.10.1.

## 1. Crear una Tabla de Rutas Personalizada
Edita el archivo /etc/iproute2/rt_tables y añade la siguiente línea:

```
200 rt_eth0
```

Explicación: Esto asigna la tabla de rutas rt_eth0 con prioridad 200.

## 2. Agregar la Ruta por Defecto a la Tabla Personalizada
Ejecuta el siguiente comando:

```
ip route add default via 192.168.10.1 dev eth0 table rt_eth0
```

Explicación: Define la puerta de enlace 192.168.10.1 como ruta por defecto para la tabla rt_eth0.

## 3. Agregar una Regla de Ruteo Basada en el Origen
Ejecuta:

```
ip rule add from 192.168.10.30/32 table rt_eth0
```

Explicación: Todo el tráfico que se origine en 192.168.10.30 usará la tabla rt_eth0 para su ruteo.

## 4. Verificar la Configuración
Para comprobar las reglas y rutas, utiliza:

```
ip rule list         # Muestra todas las reglas de ruteo
ip route show table rt_eth0   # Muestra la tabla de rutas personalizada
```



Para instalar paquetes con apt utilizando una interfaz de red específica en Linux, puedes usar ip route o network namespaces. Aquí te dejo varias opciones:

Opción 1: Usar ip route con apt
Si solo quieres que el tráfico de apt salga por una interfaz específica (ejemplo: eth0 con gateway 192.168.10.1), puedes forzar la ruta temporalmente con:

bash
Copiar
Editar
sudo ip route add default via 192.168.10.1 dev eth0 table 100
sudo ip rule add iif lo table 100
Luego instala con:

bash
Copiar
Editar
sudo apt update && sudo apt install <paquete>
Cuando termines, elimina la regla con:

bash
Copiar
Editar
sudo ip rule del iif lo table 100
sudo ip route del default via 192.168.10.1 dev eth0 table 100
Explicación: Estos comandos permiten revisar que la configuración se haya aplicado correctamente.

Nota
Estos cambios son volátiles y se perderán al reiniciar el sistema. Para hacerlos persistentes, intégralos en un script de inicio o en los archivos de configuración de red de tu distribución.
